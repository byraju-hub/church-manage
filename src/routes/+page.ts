import { redirect } from '@sveltejs/kit';

// 첫 화면은 교적 화면으로 연결
export const load = () => {
	redirect(307, '/registry');
};
