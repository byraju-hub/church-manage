// 교인 등록카드 사진을 분석해 교인 등록 칸(이름·생년월일·전화·주소…)을 채워 주는 서버 기능.
//  - 사진은 ANTHROPIC_API_KEY (Claude API, 이미지 읽기)로 분석합니다. 사진은 서버에 저장하지 않습니다.
//  - 키가 없으면 '시연용 예시'(가상 인물)를 돌려줍니다.
//
// [실제 시스템으로 옮길 때 — 꼭 해야 할 것]
//  1. 로그인 확인: Supabase 세션(JWT)을 검증하고 status='사용' 이고 can_edit = true 인 사용자만 허용합니다.
//  2. 호출 횟수 제한: 사용자별 하루 한도.
//  3. 기록: 누가 언제 분석했는지 접속기록에 남깁니다. (사진·분석 내용은 남기지 않음)
//  4. 개인정보: 등록카드 사진이 외부 AI 서비스(Anthropic)로 보내진다는 점을 개인정보 처리방침·동의서에 적습니다.
import { json } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL } from '$app/env/private';
import { FAITH_KINDS, MARITAL_STATUSES, OFFICE_NAMES } from '#lib/registry/types.ts';

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const PROMPT = `이 사진은 한국 교회의 '교인 등록카드'(손글씨 또는 인쇄)입니다. 카드에 적힌 내용만 읽어 아래 JSON 형식으로만 답하세요.
읽을 수 없거나 적혀 있지 않은 칸은 null 로 두고, 절대 지어내지 마세요. 글씨가 애매하면 가장 그럴듯한 값을 넣고 uncertain 배열에 그 칸 이름을 넣으세요.
{
  "name": 이름,
  "gender": "M" 또는 "F" 또는 null,
  "birth_date": 생년월일 "YYYY-MM-DD" (두 자리 연도는 문맥으로 19xx/20xx 판단),
  "birth_lunar": 음력이면 true, 양력이거나 표시 없으면 false,
  "phone": 휴대폰 번호 "010-0000-0000" 형식,
  "email": 이메일,
  "address1": 도로명 또는 지번 주소 (동·호수 앞까지),
  "address2": 상세주소 (아파트 동·호수 등),
  "address_zip": 우편번호 5자리,
  "occupation": 직업/직장 (예: "교사 / ○○초등학교"),
  "marital_status": ${MARITAL_STATUSES.map((m) => `"${m}"`).join(' | ')} 또는 null,
  "wedding_date": 결혼기념일 "YYYY-MM-DD",
  "previous_church": 이전 출석 교회,
  "guide_name": 인도자(전도한 사람) 이름,
  "faith_kind": ${FAITH_KINDS.map((k) => `"${k}"`).join(' | ')} 또는 null (카드의 신급·세례 여부),
  "faith_date": 신급 받은 날 "YYYY-MM-DD",
  "faith_church": 신급 받은 교회,
  "office": ${OFFICE_NAMES.map((o) => `"${o}"`).join(' | ')} 또는 null (집사는 "서리집사", 안수집사는 "시무집사"),
  "reg_date": 교회 등록일 "YYYY-MM-DD",
  "family": 카드에 적힌 가족 [{ "name": 이름, "relation": 관계(배우자·자녀 등), "birth_year": 출생연도 숫자 또는 null }],
  "memo": 위 칸에 넣지 못한 카드 내용 (짧게) 또는 null,
  "uncertain": 확실하지 않은 칸 이름 배열
}`;

function demo(note: string) {
	return {
		demo: true,
		note,
		result: {
			name: '김가상', gender: 'F', birth_date: '1985-03-14', birth_lunar: false, phone: '010-0000-1234', email: null,
			address1: '인천광역시 부평구 가상로 123', address2: '가상아파트 101동 1001호', address_zip: '21300',
			occupation: '회사원 / 가상전자', marital_status: '기혼', wedding_date: '2012-05-20', previous_church: '가상교회',
			guide_name: null, faith_kind: '세례', faith_date: '2005-04-10', faith_church: '가상교회', office: '서리집사',
			reg_date: null, family: [{ name: '이가상', relation: '배우자', birth_year: 1983 }],
			memo: '(시연용 예시) 실제 카드를 읽은 결과가 아닙니다.', uncertain: ['phone']
		}
	};
}

const dateOk = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);
function clean(r: Record<string, unknown>) {
	const fam = Array.isArray(r.family) ? r.family : [];
	return {
		name: str(r.name), gender: r.gender === 'M' || r.gender === 'F' ? r.gender : null,
		birth_date: dateOk(r.birth_date), birth_lunar: r.birth_lunar === true,
		phone: str(r.phone), email: str(r.email), address1: str(r.address1), address2: str(r.address2),
		address_zip: typeof r.address_zip === 'string' && /^\d{5}$/.test(r.address_zip.trim()) ? r.address_zip.trim() : null,
		occupation: str(r.occupation),
		marital_status: (MARITAL_STATUSES as string[]).includes(r.marital_status as string) ? r.marital_status : null,
		wedding_date: dateOk(r.wedding_date), previous_church: str(r.previous_church), guide_name: str(r.guide_name),
		faith_kind: (FAITH_KINDS as string[]).includes(r.faith_kind as string) ? r.faith_kind : null,
		faith_date: dateOk(r.faith_date), faith_church: str(r.faith_church),
		office: (OFFICE_NAMES as string[]).includes(r.office as string) ? r.office : null,
		reg_date: dateOk(r.reg_date),
		family: fam.filter((x) => x && typeof x === 'object' && str((x as Record<string, unknown>).name)).slice(0, 12)
			.map((x) => { const o = x as Record<string, unknown>; return { name: str(o.name), relation: str(o.relation), birth_year: typeof o.birth_year === 'number' ? o.birth_year : null }; }),
		memo: str(r.memo),
		uncertain: Array.isArray(r.uncertain) ? r.uncertain.filter((x) => typeof x === 'string') : []
	};
}

async function analyze(key: string, mediaType: string, base64: string) {
	const r = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
		body: JSON.stringify({
			model: ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 1500,
			messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } }, { type: 'text', text: PROMPT }] }]
		})
	});
	if (!r.ok) throw new Error(`분석 실패 (${r.status})`);
	const data = (await r.json()) as { content?: { type: string; text?: string }[] };
	const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
	const m = text.match(/\{[\s\S]*\}/);
	if (!m) throw new Error('분석 결과를 읽을 수 없습니다.');
	return clean(JSON.parse(m[0]));
}

// 주소(IP)별 호출 제한: 10분에 10번
const WINDOW_MS = 10 * 60 * 1000;
const LIMIT = 10;
const hits = new Map<string, number[]>();
function tooMany(key: string) {
	const now = Date.now();
	const list = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
	list.push(now);
	hits.set(key, list);
	return list.length > LIMIT;
}

export async function POST({ request, getClientAddress }: { request: Request; getClientAddress: () => string }) {
	// 같은 사이트의 교인 등록 화면에서 보낸 요청만 받음
	const origin = request.headers.get('origin');
	if (origin && origin !== new URL(request.url).origin) return json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
	if (request.headers.get('x-card-scan') !== '1') return json({ error: '허용되지 않은 요청입니다.' }, { status: 403 });
	let ip = 'unknown';
	try { ip = getClientAddress(); } catch {}
	if (tooMany(ip)) return json({ error: '잠시 후 다시 시도해 주세요. (10분에 10번까지)' }, { status: 429 });

	let file: File | null = null;
	try {
		const f = (await request.formData()).get('file');
		file = f instanceof File ? f : null;
	} catch {
		return json({ error: '사진을 읽을 수 없습니다.' }, { status: 400 });
	}
	if (!file || !file.size) return json({ error: '사진을 선택해 주세요.' }, { status: 400 });
	if (file.size > MAX_BYTES) return json({ error: '사진이 너무 큽니다. (8MB 이하)' }, { status: 413 });
	if (!TYPES.includes(file.type)) return json({ error: '사진 파일(JPG, PNG)만 올릴 수 있습니다.' }, { status: 415 });

	if (!ANTHROPIC_API_KEY) return json(demo('서버에 ANTHROPIC_API_KEY 가 설정되지 않아 시연용 예시(가상 인물)를 보여 드립니다.'));
	try {
		const buf = new Uint8Array(await file.arrayBuffer());
		let bin = '';
		for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
		return json({ demo: false, note: '', result: await analyze(ANTHROPIC_API_KEY, file.type, btoa(bin)) });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : '분석 중 오류가 났습니다.' }, { status: 502 });
	}
}
