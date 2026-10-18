import { defineEnvVars } from '@sveltejs/kit/env';

export const variables = defineEnvVars({
	PUBLIC_SUPABASE_URL: { public: true, static: true, description: 'Supabase 프로젝트 URL' },
	PUBLIC_SUPABASE_ANON_KEY: { public: true, static: true, description: 'Supabase anon(publishable) key' }
});
