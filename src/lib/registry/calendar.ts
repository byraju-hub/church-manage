// 대시보드 캘린더: 해마다 날짜가 정해지는 교회 절기·기념일을 계산합니다.
// (교회 창립 기념일 날짜는 가상입니다. 실제 날짜는 관리자 화면에서 정하게 됩니다.)

export const pad2 = (n: number) => String(n).padStart(2, '0');
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const at = (y: number, m: number, d: number) => new Date(y, m - 1, d);
export function addDays(iso: string, n: number): string {
	const [y, m, d] = iso.split('-').map(Number);
	const x = at(y, m, d);
	x.setDate(x.getDate() + n);
	return isoDate(x);
}

// 부활주일 (서방 교회 기준)
export function easter(y: number): string {
	const a = y % 19, b = Math.floor(y / 100), c = y % 100;
	const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
	const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
	const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
	const m = Math.floor((a + 11 * h + 22 * l) / 451);
	const month = Math.floor((h + l - 7 * m + 114) / 31);
	const day = ((h + l - 7 * m + 114) % 31) + 1;
	return `${y}-${pad2(month)}-${pad2(day)}`;
}

// 그 달의 n번째 일요일 (n=-1이면 마지막)
export function nthSunday(y: number, m: number, n: number): string {
	if (n > 0) {
		const first = at(y, m, 1);
		return isoDate(at(y, m, 1 + ((7 - first.getDay()) % 7) + (n - 1) * 7));
	}
	const last = at(y, m + 1, 0);
	return isoDate(at(y, m, last.getDate() - last.getDay()));
}

export interface Seasonal { date: string; end_date: string | null; title: string }

export function churchSeasons(y: number): Seasonal[] {
	const e = easter(y);
	const s = (date: string, title: string, end_date: string | null = null): Seasonal => ({ date, end_date, title });
	return [
		s(`${y}-01-01`, '신년 감사 예배'),
		s(`${y}-05-10`, '교회 창립 기념일 (가상 날짜)'),
		s(nthSunday(y, 5, 1), '어린이주일'),
		s(nthSunday(y, 5, 2), '어버이주일'),
		s(addDays(e, -7), '고난주간 시작 (종려주일)', addDays(e, -1)),
		s(e, '부활주일'),
		s(addDays(e, 49), '성령강림주일'),
		s(nthSunday(y, 7, 1), '맥추감사주일'),
		s(nthSunday(y, 10, -1), '종교개혁주일'),
		s(nthSunday(y, 11, 3), '추수감사주일'),
		s(`${y}-12-25`, '성탄절'),
		s(`${y}-12-31`, '송구영신 예배')
	];
}

// 달력에 쓰는 한 줄
export interface CalItem {
	date: string;
	end_date?: string | null;
	kind: import('./types.ts').EventKind;
	title: string;
	sub?: string;
	person_id?: string | null;
	href?: string;
}

export const KIND_COLOR: Record<import('./types.ts').EventKind, string> = {
	생일: '#e08a00',
	'성도 기념일': '#d6336c',
	'교회 기념일': '#7048e8',
	'사역 일정': '#2f9e44',
	'성례 일정': '#1c7ed6',
	'심방 계획': '#0c8599'
};
