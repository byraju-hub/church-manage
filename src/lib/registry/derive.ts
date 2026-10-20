// 재적·신급·직분의 '지금 값'은 이력에서 계산합니다. (안내서 '재적·신급·직분')
import type {
	Category, FaithEvent, FaithKind, OfficeName, OfficeStatus, OfficeTerm, Person, StatusEvent, StatusKind
} from './types.ts';
import { OFFICE_NAMES } from './types.ts';

export interface CurrentStatus {
	status: StatusKind | null;
	memberCert: boolean; // 앱 교인 인증
}

const STATUS_ON: Record<StatusKind, boolean> = {
	등록: true, 전입: true, 복적: true, 보류: true, 보관: false, 전출: false, 별세: false, 제적: false
};
const STATUS_NOW: Record<StatusKind, string> = {
	등록: '재적', 전입: '재적', 복적: '재적', 보류: '보류', 보관: '보관', 전출: '전출', 별세: '별세', 제적: '제적'
};

// 날짜를 모르는 기록은 가장 오래된 것으로 보고, 같으면 입력 순서를 따름
function sortByDate<T extends { event_date?: string | null; start_date?: string | null }>(xs: T[]): T[] {
	return xs
		.map((x, i) => ({ x, i }))
		.sort((a, b) => {
			const da = a.x.event_date ?? a.x.start_date ?? '';
			const db = b.x.event_date ?? b.x.start_date ?? '';
			return da.localeCompare(db) || a.i - b.i;
		})
		.map((o) => o.x);
}

export function currentStatus(events: StatusEvent[]): CurrentStatus & { label: string } {
	if (!events.length) return { status: null, memberCert: false, label: '기록 없음' };
	const last = sortByDate(events).at(-1)!;
	return { status: last.kind, memberCert: STATUS_ON[last.kind], label: STATUS_NOW[last.kind] };
}

// 등록일 = 첫 '등록' 또는 '전입' 날짜
export function registeredOn(events: StatusEvent[]): string | null {
	const first = sortByDate(events.filter((e) => e.kind === '등록' || e.kind === '전입'))[0];
	return first?.event_date ?? null;
}

export type FaithNow = '세례교인' | '유아세례교인' | '학습교인' | '원입교인' | '미확인';

export function currentFaith(events: FaithEvent[], person: Pick<Person, 'faith_checked_on'>): FaithNow {
	const has = (k: FaithKind) => events.some((e) => e.kind === k);
	if (has('세례') || has('입교')) return '세례교인';
	if (has('유아세례')) return '유아세례교인';
	if (has('학습')) return '학습교인';
	if (person.faith_checked_on) return '원입교인';
	return '미확인';
}

export function currentOffice(terms: OfficeTerm[]): OfficeTerm | null {
	// 끝나지 않았고 사임이 아닌 직분 중 가장 높은 것
	const live = terms.filter((t) => !t.end_date && t.rank_status !== '사임');
	live.sort((a, b) => OFFICE_NAMES.indexOf(a.office) - OFFICE_NAMES.indexOf(b.office));
	return live[0] ?? null;
}

// 호칭: 시무는 직분 그대로, 나머지는 신분을 앞에 붙임 (서리집사는 '집사', 시무집사 은퇴는 '은퇴집사')
export function officeTitle(t: { office: OfficeName; rank_status: OfficeStatus }): string {
	if (t.office === '서리집사') return t.rank_status === '명예' ? '명예집사' : '집사';
	const base = t.office === '시무집사' && t.rank_status !== '시무' ? '집사' : t.office;
	return t.rank_status === '시무' ? base : `${t.rank_status}${base}`;
}

// 이름 옆에 붙이는 직분 표시: 직분 (어떤 직분인지). 예) 권사 (시무), 권사 (은퇴), 집사 (서리), 목사 (담임)
export function officeWithKind(t: { office: OfficeName; rank_status: OfficeStatus }, clergy?: string | null): string {
	const base = t.office === '시무집사' || t.office === '서리집사' ? '집사' : t.office;
	const kind = clergy && (t.office === '목사' || t.office === '전도사') ? clergy.replace(t.office, '') : t.rank_status;
	return `${base} (${kind})`;
}

// 교인구분(카테고리)의 경로: ['교인', '장년', '예배출석']
export function categoryPath(cats: Category[], id: string | null): Category[] {
	const out: Category[] = [];
	let cur = id ? cats.find((c) => c.id === id) : undefined;
	while (cur) {
		out.unshift(cur);
		const pid: string | null = cur.parent_id;
		cur = pid ? cats.find((c) => c.id === pid) : undefined;
	}
	return out;
}

export function ageOf(birth: string | null, today = new Date()): number | null {
	if (!birth) return null;
	const [y, m, d] = birth.split('-').map(Number);
	let age = today.getFullYear() - y;
	if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
	return age;
}

export function fullAddress(p: Person, household?: { address: string | null } | null): string {
	const own = [p.address1, p.address2].filter(Boolean).join(' ');
	return own || household?.address || '';
}
