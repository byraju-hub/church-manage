// 서버에서만 쓰는 환경 변수 (심방 녹음·문서 분석, 교인 등록카드 사진 읽기). 값이 없어도 앱은 동작하고, 분석 기능은 시연용 예시를 보여 줍니다.
// 키는 Cloudflare Pages 환경 변수 또는 로컬 .env 파일에 넣고, 저장소에는 올리지 않습니다.
import { defineEnvVars } from '@sveltejs/kit/env';

const optional = (value: string | undefined) => (value ? value : undefined);

export const variables = defineEnvVars({
	ANTHROPIC_API_KEY: { schema: optional, description: '심방 내용 분석 · 교인 등록카드 사진 읽기(Claude API)' },
	ANTHROPIC_MODEL: { schema: optional, description: '분석에 쓸 모델 (비우면 기본값)' },
	OPENAI_API_KEY: { schema: optional, description: '심방 녹음 받아쓰기' },
	SOLAPI_API_KEY: { schema: optional, description: '문자 발송 (솔라피 API Key)' },
	SOLAPI_API_SECRET: { schema: optional, description: '문자 발송 (솔라피 API Secret)' },
	SOLAPI_SENDER: { schema: optional, description: '문자 발신번호 (솔라피에 등록한 교회 번호, 예: 0321234567)' },
	SOLAPI_TEST_TO: { schema: optional, description: '시험용: 값이 있으면 모든 문자를 이 번호 한 곳으로만 보냄' }
});
