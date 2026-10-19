// 교적 데이터 안내서(PDF) 구조를 따르는 프로토타입 타입.
// supabase/migrations/0002_registry.sql 과 대응합니다.

export type StatusKind = '등록' | '전입' | '복적' | '보류' | '전출' | '별세' | '제적';
export type FaithKind = '학습' | '세례' | '유아세례' | '입교';
export type OfficeName = '목사' | '전도사' | '장로' | '시무집사' | '권사' | '서리집사';
export type OfficeStatus = '시무' | '은퇴' | '원로' | '명예' | '협동' | '사임';
export type MaritalStatus = '미혼' | '기혼' | '사별' | '기타';
export type ConsentKind = '교적 등록' | '민감정보' | '요람 공개' | '보호자 동의';
export type ConsentMethod = '서면' | '앱' | '구두';

export const STATUS_KINDS: StatusKind[] = ['등록', '전입', '복적', '보류', '전출', '별세', '제적'];
export const FAITH_KINDS: FaithKind[] = ['학습', '세례', '유아세례', '입교'];
// 직분 높은 순 (이 교회는 '안수집사' 대신 '시무집사')
export const OFFICE_NAMES: OfficeName[] = ['목사', '전도사', '장로', '시무집사', '권사', '서리집사'];
export const OFFICE_STATUSES: OfficeStatus[] = ['시무', '은퇴', '원로', '명예', '협동', '사임'];
export const RELATIONS = ['본인', '배우자', '자녀', '부모', '며느리', '사위', '손자녀', '형제자매', '기타'];
export const CONSENT_KINDS: ConsentKind[] = ['교적 등록', '민감정보', '요람 공개', '보호자 동의'];

export interface Person {
	id: string;
	name: string;
	name_note: string | null; // 동명이인 구분 (예: 1975년생, 2구역)
	// 앱 프로필(custom_users)에 있는 칸
	phone: string | null;
	gender: 'M' | 'F' | null;
	birth_date: string | null;
	email: string | null;
	has_account: boolean; // 앱 가입 여부 (계산)
	// 교적 카드(registry.people)에 있는 칸
	birth_lunar: boolean;
	reg_no: string | null;
	address_zip: string | null;
	address1: string | null;
	address2: string | null;
	occupation: string | null;
	workplace: string | null;
	marital_status: MaritalStatus | null;
	wedding_date: string | null;
	previous_church: string | null;
	guide_person_id: string | null;
	guide_name: string | null;
	sms_opt_out: boolean;
	faith_checked_on: string | null;
	note: string | null;
	purged_on: string | null;
}

export interface Household {
	id: string;
	no: string;
	zip: string | null;
	address: string | null;
	home_phone: string | null;
	note: string | null;
}

export interface HouseholdMember {
	id: string;
	household_id: string;
	person_id: string | null; // 교인이 아니면 null
	name: string; // 교인이 아닐 때만 사용
	birth_year: number | null;
	relation: string; // 세대주 기준
	sort_order: number;
	note: string | null;
}

export interface StatusEvent {
	id: string;
	person_id: string;
	kind: StatusKind;
	event_date: string | null;
	reason: string | null;
	church: string | null; // 전입·전출 교회
}

export interface FaithEvent {
	id: string;
	person_id: string;
	kind: FaithKind;
	event_date: string | null;
	church: string | null; // 받은 교회(비면 본 교회)
	officiant: string | null;
	note: string | null;
}

export interface OfficeTerm {
	id: string;
	person_id: string;
	office: OfficeName;
	rank_status: OfficeStatus;
	start_date: string | null;
	end_date: string | null;
	note: string | null;
}

export interface PersonGroup {
	person_id: string;
	community: string; // 출석부의 공동체
	small_group: string; // 출석부의 소그룹
}

export interface Note {
	id: string;
	person_id: string;
	body: string;
	author: string;
	created_at: string;
}

export interface LegacyMemo {
	id: string;
	person_id: string;
	body: string;
}

export interface Consent {
	id: string;
	person_id: string;
	kind: ConsentKind;
	policy_version: string;
	consent_date: string | null;
	method: ConsentMethod;
	guardian_name: string | null;
	revoked_on: string | null;
}

export interface ChangeLogEntry {
	id: string;
	person_id: string;
	at: string;
	by: string;
	field: string;
	before: string | null;
	after: string | null;
}

export interface AccessLogEntry {
	id: string;
	at: string;
	who: string;
	action: string; // 검색, 열람, 수정, 내려받기, 출력
	target: string;
}

// ---- 안내서의 '새 자료 필요' 기능을 시험해 보기 위한 제안 구조 ----
export interface Visit {
	id: string;
	person_id: string;
	visit_date: string;
	visitor: string;
	content: string;
	follow_up: string | null;
}

export interface Affiliation {
	id: string;
	person_id: string;
	org: string; // 선교회·부서·찬양대·봉사팀
	role: string | null;
	start_date: string | null;
	end_date: string | null;
}

export interface GroupHistory {
	id: string;
	person_id: string;
	small_group: string;
	start_date: string | null;
	end_date: string | null;
}

// 교적 권한: 기본(열람) + 아래 항목을 켜고 끔
export interface Perms {
	edit: boolean;
	export: boolean;
	visit: boolean;
	admin: boolean;
}
