// 교인 목록에서 고른 교인들에게 문자(SMS·LMS)를 보내는 서버 기능 — 솔라피(SOLAPI) 사용.
//  - SOLAPI_API_KEY · SOLAPI_API_SECRET · SOLAPI_SENDER 가 없으면 실제로 보내지 않고 '시연'으로 결과만 돌려줍니다.
//  - SOLAPI_TEST_TO 가 있으면 모든 문자를 그 번호 하나로만 보냅니다(시험용).
//  - 프로토타입의 가상 번호(010-0000-xxxx)는 실제 번호가 아니므로 절대 보내지 않습니다.
//
// [실제 시스템으로 옮길 때 — 꼭 해야 할 것]
//  1. 로그인 확인: Supabase 세션(JWT)을 검증하고 status='사용' 이고 등급이 A 인 사용자만 허용합니다.
//  2. 받는 사람은 화면이 보낸 번호를 믿지 말고, 교인 ID 목록을 받아 서버에서 DB로 번호를 다시 찾고 수신 거부를 한 번 더 거릅니다.
//  3. 기록: 누가 언제 몇 명에게 어떤 내용을 보냈는지 발송 기록 표에 남깁니다.
//  4. 하루 발송 한도, 광고성 문자 규정('(광고)' 표시, 수신 거부 방법, 야간 발송 제한)을 지킵니다.
import { json } from '@sveltejs/kit';
import { SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER, SOLAPI_TEST_TO } from '$app/env/private';

const MAX_TO = 1000; // 한 번에 보낼 수 있는 최대 인원
const MAX_BYTES = 2000; // 장문(LMS) 최대 길이
const digits = (s: string) => s.replace(/\D/g, '');
// 문자 길이는 한글 2바이트·영문 숫자 1바이트로 셈 (90바이트까지 단문)
const bytes = (s: string) => [...s].reduce((n, ch) => n + (ch.charCodeAt(0) < 128 ? 1 : 2), 0);
const isFake = (to: string) => to.startsWith('0100000');
const isMobile = (to: string) => /^01[016789]\d{7,8}$/.test(to);

async function hmac(secret: string, msg: string) {
	const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
	return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// 솔라피 v4 여러 건 발송 (한 번 요청으로 묶어서). 단문·장문은 솔라피가 길이를 보고 자동으로 정함
async function solapiSend(messages: { to: string; text: string; subject?: string }[]) {
	const date = new Date().toISOString();
	const salt = crypto.randomUUID().replace(/-/g, '');
	const signature = await hmac(SOLAPI_API_SECRET!, date + salt);
	const r = await fetch('https://api.solapi.com/messages/v4/send-many/detail', {
		method: 'POST',
		headers: {
			Authorization: `HMAC-SHA256 apiKey=${SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`,
			'Content-Type': 'application/json'
		},
		body: JSON.stringify({ messages: messages.map((m) => ({ ...m, from: digits(SOLAPI_SENDER!) })) })
	});
	const data = (await r.json().catch(() => ({}))) as { errorMessage?: string; groupInfo?: { count?: { registeredSuccess?: number; registeredFailed?: number } }; failedMessageList?: unknown[] };
	if (!r.ok) throw new Error(data.errorMessage || `발송 실패 (${r.status})`);
	return { ok: data.groupInfo?.count?.registeredSuccess ?? messages.length, failed: data.groupInfo?.count?.registeredFailed ?? data.failedMessageList?.length ?? 0 };
}

// 주소(IP)별 호출 제한: 10분에 5번
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 5;
const hits = new Map<string, number[]>();
function tooMany(key: string) {
	const now = Date.now();
	const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
	list.push(now);
	hits.set(key, list);
	return list.length > LIMIT;
}

export async function POST({ request, getClientAddress }: { request: Request; getClientAddress: () => string }) {
	// 같은 사이트의 교인 목록 화면에서 보낸 요청만 받음
	const origin = request.headers.get('origin');
	if (origin && origin !== new URL(request.url).origin) return json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
	if (request.headers.get('x-sms-send') !== '1') return json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
	let ip = 'unknown';
	try { ip = getClientAddress(); } catch {}
	if (tooMany(ip)) return json({ error: '잠시 후 다시 시도해 주세요. (10분에 5번까지)' }, { status: 429 });

	let body: { subject?: unknown; messages?: unknown };
	try { body = await request.json(); } catch { return json({ error: '보낼 내용을 읽을 수 없습니다.' }, { status: 400 }); }
	const subject = typeof body.subject === 'string' ? body.subject.trim().slice(0, 40) : '';
	const list = Array.isArray(body.messages) ? body.messages : [];
	const messages = list
		.map((m) => (m && typeof m === 'object' ? (m as Record<string, unknown>) : {}))
		.map((m) => ({ to: digits(String(m.to ?? '')), text: String(m.text ?? '').trim() }))
		.filter((m) => isMobile(m.to) && m.text);
	if (!messages.length) return json({ error: '보낼 사람이나 내용이 없습니다.' }, { status: 400 });
	if (messages.length > MAX_TO) return json({ error: `한 번에 ${MAX_TO}명까지 보낼 수 있습니다.` }, { status: 400 });
	if (messages.some((m) => bytes(m.text) > MAX_BYTES)) return json({ error: '내용이 너무 깁니다. (한글 약 1,000자까지)' }, { status: 400 });

	const real = messages.filter((m) => !isFake(m.to));
	const fake = messages.length - real.length;
	if (!SOLAPI_API_KEY || !SOLAPI_API_SECRET || !SOLAPI_SENDER) {
		return json({ demo: true, sent: 0, note: `솔라피 키가 설정되지 않아 실제로 보내지 않았습니다. (시연: ${messages.length}명에게 보낸 것으로 처리)` });
	}
	// 시험 모드: 모든 문자를 한 번호로만 (첫 사람 내용 한 통)
	const test = SOLAPI_TEST_TO ? digits(SOLAPI_TEST_TO) : '';
	const out = test ? [{ ...messages[0], to: test }] : real;
	if (!out.length) return json({ demo: true, sent: 0, note: `프로토타입의 가상 번호(010-0000-…)라 실제로 보내지 않았습니다. (${fake}명)` });
	try {
		const r = await solapiSend(out.map((m) => (subject && bytes(m.text) > 90 ? { ...m, subject } : m)));
		const note = test ? `시험 모드: ${test} 한 곳으로만 보냈습니다.` : fake ? `가상 번호 ${fake}명은 보내지 않았습니다.` : '';
		return json({ demo: false, sent: r.ok, failed: r.failed, note });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : '발송 중 오류가 났습니다.' }, { status: 502 });
	}
}
