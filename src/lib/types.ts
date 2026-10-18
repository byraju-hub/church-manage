// supabase/migrations/0001_init.sql 의 테이블과 1:1 대응

export type Gender = 'M' | 'F';
export type MemberStatus = 'newcomer' | 'active' | 'inactive' | 'transferred' | 'deceased';
export type BaptismType = 'infant' | 'adult' | 'none';

export interface Group {
	id: string;
	name: string;
	leader_member_id: string | null;
}

export interface Family {
	id: string;
	name: string;
	address: string | null;
}

export interface Member {
	id: string;
	name: string;
	gender: Gender | null;
	birth_date: string | null;
	phone: string | null;
	email: string | null;
	address: string | null;
	family_id: string | null;
	family_relation: string | null;
	group_id: string | null;
	status: MemberStatus;
	position: string | null;
	registered_at: string | null;
	baptism_type: BaptismType | null;
	baptism_date: string | null;
	previous_church: string | null;
	memo: string | null;
}

export interface Visit {
	id: string;
	member_id: string;
	visit_date: string;
	visit_type: string | null;
	visited_by: string | null;
	content: string | null;
}

export const STATUS_LABEL: Record<MemberStatus, string> = {
	newcomer: '새가족',
	active: '등록교인',
	inactive: '휴적',
	transferred: '이명',
	deceased: '소천'
};

export const BAPTISM_LABEL: Record<BaptismType, string> = {
	infant: '유아세례',
	adult: '입교(세례)',
	none: '미세례'
};

export const POSITIONS = ['목사', '장로', '권사', '안수집사', '집사', '성도'];
