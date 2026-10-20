// 심방 녹음·문서를 분석해 심방 기록 칸(내용·말씀·찬송·동행자…)을 채워 주는 서버 기능.
//  - 녹음 파일  → OPENAI_API_KEY 로 받아쓰기(Whisper) → 요약
//  - 텍스트·PDF → 바로 요약
//  - 요약은 ANTHROPIC_API_KEY (Claude API)로 만듭니다.
// 키가 없으면 '시연용 예시'를 돌려줍니다. 키는 Cloudflare 환경 변수(또는 로컬 .env)에 넣으며 코드·저장소에는 두지 않습니다.
import { json } from '@sveltejs/kit';
import { ANTHROPIC_API_KEY, ANTHROPIC_MODEL, OPENAI_API_KEY } from '$app/env/private';

const KINDS = ['대심방', '새신자', '일반', '결혼', '출산', '돌', '입학', '졸업', '회갑', '장례', '추도', '개업', '이사', '병문안', '전도'];
const MAX_BYTES = 24 * 1024 * 1024;

const PROMPT = `다음은 교회 교역자가 한 심방(가정·병원 방문 또는 전화)의 녹취록 또는 기록입니다. 아래 JSON 형식으로만 답하세요. 없는 정보는 null 로 두고, 지어내지 마세요.
{
  "kind": 심방 구분 중 하나 (${KINDS.join(', ')}) 또는 null,
  "content": 심방 내용 요약 (한국어 3~6문장, 건강·가정 사정 등 민감한 내용은 꼭 필요한 만큼만),
  "scripture": 읽거나 나눈 성경 말씀 (예: "시편 23편") 또는 null,
  "hymn": 부른 찬송 (예: "찬 305장") 또는 null,
  "follow_up": 후속 조치 (예: "2주 뒤 재방문") 또는 null,
  "companions": 동행한 사람 이름들 배열 (없으면 [])
}`;

function demo(note: string) {
	return {
		demo: true,
		note,
		transcript: null,
		result: {
			kind: '일반',
			content: '(시연용 예시) 가정을 방문해 근황을 나누고 가족의 건강과 직장 일을 위해 함께 기도했습니다.',
			scripture: '빌립보서 4:6-7',
			hymn: '찬 305장',
			follow_up: '2주 뒤 안부 전화',
			companions: [] as string[]
		}
	};
}

async function transcribe(file: File, key: string): Promise<string> {
	const fd = new FormData();
	fd.append('file', file, file.name || 'visit.m4a');
	fd.append('model', 'whisper-1');
	fd.append('language', 'ko');
	const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd });
	if (!r.ok) throw new Error(`받아쓰기 실패 (${r.status})`);
	return ((await r.json()) as { text?: string }).text ?? '';
}

async function summarize(key: string, input: { text?: string; pdfBase64?: string }) {
	const content: unknown[] = [];
	if (input.pdfBase64) content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: input.pdfBase64 } });
	if (input.text) content.push({ type: 'text', text: `<기록>\n${input.text.slice(0, 60000)}\n</기록>` });
	content.push({ type: 'text', text: PROMPT });
	const r = await fetch('https://api.anthropic.com/v1/messages', {
		method: 'POST',
		headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
		body: JSON.stringify({ model: ANTHROPIC_MODEL || 'claude-sonnet-5-5', max_tokens: 1200, messages: [{ role: 'user', content }] })
	});
	if (!r.ok) throw new Error(`분석 실패 (${r.status})`);
	const data = (await r.json()) as { content?: { type: string; text?: string }[] };
	const text = data.content?.find((c) => c.type === 'text')?.text ?? '';
	const m = text.match(/\{[\s\S]*\}/);
	if (!m) throw new Error('분석 결과를 읽을 수 없습니다.');
	return JSON.parse(m[0]);
}

export async function POST({ request }: { request: Request }) {
	let file: File | null = null;
	try {
		const fd = await request.formData();
		const f = fd.get('file');
		file = f instanceof File ? f : null;
	} catch {
		return json({ error: '파일을 읽을 수 없습니다.' }, { status: 400 });
	}
	if (!file || !file.size) return json({ error: '파일을 선택해 주세요.' }, { status: 400 });
	if (file.size > MAX_BYTES) return json({ error: '파일이 너무 큽니다. (24MB 이하)' }, { status: 413 });

	const name = file.name.toLowerCase();
	const isAudio = file.type.startsWith('audio/') || file.type.startsWith('video/') || /\.(m4a|mp3|wav|webm|ogg|aac|mp4|mpeg|mpga)$/.test(name);
	const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf');
	const isText = file.type.startsWith('text/') || /\.(txt|md)$/.test(name);
	if (!isAudio && !isPdf && !isText) return json({ error: '녹음 파일(m4a, mp3, wav), PDF, 텍스트(txt)만 올릴 수 있습니다.' }, { status: 415 });

	const claude = ANTHROPIC_API_KEY;
	const openai = OPENAI_API_KEY;
	if (!claude) return json(demo('서버에 ANTHROPIC_API_KEY 가 설정되지 않아 시연용 예시를 보여 드립니다.'));
	if (isAudio && !openai) return json(demo('녹음 받아쓰기에 필요한 OPENAI_API_KEY 가 설정되지 않아 시연용 예시를 보여 드립니다.'));

	try {
		let transcript: string | null = null;
		let result;
		if (isAudio) {
			transcript = await transcribe(file, openai!);
			result = await summarize(claude, { text: transcript });
		} else if (isPdf) {
			const buf = new Uint8Array(await file.arrayBuffer());
			let bin = '';
			for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
			result = await summarize(claude, { pdfBase64: btoa(bin) });
		} else {
			transcript = await file.text();
			result = await summarize(claude, { text: transcript });
		}
		if (result?.kind && !KINDS.includes(result.kind)) result.kind = null;
		return json({ demo: false, note: '', transcript, result });
	} catch (e) {
		return json({ error: e instanceof Error ? e.message : '분석 중 오류가 났습니다.' }, { status: 502 });
	}
}
