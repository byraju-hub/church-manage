// 교적 데이터 안내서(PDF)와 '교적 프로그램 구조' 문서를 따르는 프로토타입 타입.
// supabase/migrations/0002_registry.sql 과 대응합니다.

// '보관' = 삭제할 수 없는 교적을 넣어 두는 구분 (5년 자동 삭제에서 제외)
export type StatusKind = '등록' | '전입' | '복적' | '보류' | '보관' | '전출' | '별세' | '제적';
export type FaithKind = '학습' | '세례' | '유아세례' | '입교';
export type OfficeName = '목사' | '전도사' | '사모' | '장로' | '시무집사' | '권사' | '서리집사';
export type OfficeStatus = '시무' | '은퇴' | '원로' | '명예' | '협동' | '사임' | '전입' | '서리';
export type ClergyTitle = '담임목사' | '부목사' | '교육목사' | '전임전도사' | '교육전도사';
export type EduDept = '청년부' | '중고등부' | '유초등부' | '유치부' | '영아부';
export type MaritalStatus = '미혼' | '기혼' | '이혼' | '사별' | '기타';
export type ConsentKind = '교적 등록' | '민감정보' | '요람 공개' | '보호자 동의';
export type ConsentMethod = '서면' | '앱' | '구두';
export type VisitMethod = '방문' | '전화';
export type VisitState = '계획' | '완료';

export const STATUS_KINDS: StatusKind[] = ['등록', '전입', '복적', '보류', '보관', '전출', '별세', '제적'];
export const FAITH_KINDS: FaithKind[] = ['학습', '세례', '유아세례', '입교'];
// 직분 높은 순 (이 교회는 '안수집사' 대신 '시무집사')
export const OFFICE_NAMES: OfficeName[] = ['목사', '전도사', '사모', '장로', '시무집사', '권사', '서리집사'];
export const OFFICE_STATUSES: OfficeStatus[] = ['시무', '은퇴', '원로', '명예', '협동', '사임', '전입', '서리'];
// 직분마다 고를 수 있는 신분 ('교적 프로그램 구조' 문서)
export const OFFICE_STATUS_OPTIONS: Record<OfficeName, OfficeStatus[]> = {
	목사: ['시무', '은퇴', '원로', '명예', '협동', '사임'],
	전도사: ['시무', '은퇴', '사임'],
	사모: ['시무', '은퇴'],
	장로: ['시무', '은퇴', '원로', '협동'],
	시무집사: ['시무', '은퇴', '협동', '전입'],
	권사: ['시무', '은퇴', '협동', '전입', '명예'],
	서리집사: ['서리', '명예']
};
// 임직일·임직교회를 기록하는 중직자
export const ORDAINED: OfficeName[] = ['장로', '시무집사', '권사'];
export const CLERGY_TITLES: ClergyTitle[] = ['담임목사', '부목사', '교육목사', '전임전도사', '교육전도사'];
// 심방 기록은 전임 교역자까지만 볼 수 있음 (교육전도사 제외)
export const FULL_TIME_CLERGY: ClergyTitle[] = ['담임목사', '부목사', '교육목사', '전임전도사'];
// 직분 선택 목록: 교역자 직책(담임·부·교육 목사, 전임·교육 전도사)을 직분과 함께 고름
export interface Position { label: string; office: OfficeName | null; clergy: ClergyTitle | null }
export const POSITIONS: Position[] = [
	{ label: '성도', office: null, clergy: null },
	{ label: '담임목사', office: '목사', clergy: '담임목사' },
	{ label: '부목사', office: '목사', clergy: '부목사' },
	{ label: '교육목사', office: '목사', clergy: '교육목사' },
	{ label: '전임전도사', office: '전도사', clergy: '전임전도사' },
	{ label: '교육전도사', office: '전도사', clergy: '교육전도사' },
	{ label: '사모', office: '사모', clergy: null },
	{ label: '장로', office: '장로', clergy: null },
	{ label: '시무집사', office: '시무집사', clergy: null },
	{ label: '권사', office: '권사', clergy: null },
	{ label: '서리집사', office: '서리집사', clergy: null }
];
// 동명이인 구분: A, B, C ...
export const NAME_NOTES = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));
export const EDU_DEPTS: EduDept[] = ['영아부', '유치부', '유초등부', '중고등부', '청년부'];
export const MARITAL_STATUSES: MaritalStatus[] = ['미혼', '기혼', '이혼', '사별', '기타'];
// 전도회: 남 1~6, 여 1~10
export const MISSION_SOCIETIES: string[] = [
	...Array.from({ length: 6 }, (_, i) => `${i + 1}남전도회`),
	...Array.from({ length: 10 }, (_, i) => `${i + 1}여전도회`)
];
export const RELATIONS = ['본인', '배우자', '자녀', '부모', '며느리', '사위', '손자녀', '형제자매', '기타'];
export const CONSENT_KINDS: ConsentKind[] = ['교적 등록', '민감정보', '요람 공개', '보호자 동의'];
// 디모데 심방 구분 목록을 기준으로 함 (실제 코드표는 스데반정보 덤프로 확인)
export const VISIT_KINDS = ['대심방', '새신자', '일반', '결혼', '출산', '돌', '입학', '졸업', '회갑', '장례', '추도', '개업', '이사', '병문안', '전도'];
export const MAX_CATEGORY_DEPTH = 3;

export interface Person {
	id: string;
	name: string;
	name_note: string | null; // 동명이인 구분 (예: 1975년생)
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
	photo: string | null; // 사진 (작은 이미지)
	category_id: string | null; // 교인구분 (3단계 카테고리 중 하나)
	clergy_title: ClergyTitle | null; // 교역자 직책 (신분과 별개)
	edu_dept: EduDept | null; // 교육부서 (청년·교육부서인 경우)
	mission_society: string | null; // 전도회 (예: 3남전도회, 5여전도회)
	big_family_head_id: string | null; // 대가족 세대주
	big_family_relation: string | null; // 대가족 세대주 기준 관계
}

// 교인구분: 3단계까지 펼쳐지는 카테고리 (관리자 화면에서 이름을 바꿀 수 있음)
export interface Category {
	id: string;
	parent_id: string | null;
	name: string;
	sort_order: number;
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
	start_date: string | null; // 임직일
	end_date: string | null;
	church: string | null; // 임직교회 (비면 본 교회, 타교 임직이면 그 교회 이름)
	note: string | null; // 휴직·무임 등은 여기에 적음
}

// 소그룹 편성: 공동체(뿌리·줄기·열매) 아래 소그룹. 출석부의 편성표 자료
export interface SmallGroup {
	id: string;
	community: string;
	name: string;
	place: string | null; // 모임 장소
	leader_id: string | null; // 인도자
	care: boolean; // 자녀 돌봄 편성 (로뎀나무숲)
	sort_order: number;
}

export interface PersonGroup {
	person_id: string;
	community: string; // 출석부의 공동체
	small_group: string; // 출석부의 소그룹
}

// 출석부에서 인도자가 쓰는 개별 특이사항
export interface GroupNote {
	id: string;
	person_id: string;
	small_group: string;
	date: string;
	body: string;
	author: string;
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

// ---- 심방 ----
export interface Visit {
	id: string;
	person_id: string;
	visit_date: string;
	state: VisitState; // 계획 → 완료
	kind: string; // 심방 구분 (VISIT_KINDS)
	method: VisitMethod;
	pastor: string; // 담당 교역자
	companions: string | null; // 동행자
	scripture: string | null; // 말씀
	hymn: string | null; // 찬송
	content: string;
	follow_up: string | null;
}

// ---- 출석 (출석부는 별도 시스템. 여기서는 이번에 입력한 것만 보관) ----
export interface AttendanceMark {
	present: boolean;
	reason: string | null; // 특이사항·사유
}

// ---- 일정 (대시보드 캘린더) ----
export type EventKind = '생일' | '성도 기념일' | '교회 기념일' | '사역 일정' | '성례 일정' | '심방 계획';
export const EVENT_KINDS: EventKind[] = ['생일', '성도 기념일', '교회 기념일', '사역 일정', '성례 일정', '심방 계획'];
export interface ChurchEvent {
	id: string;
	kind: Exclude<EventKind, '생일' | '심방 계획'>;
	date: string;
	end_date: string | null;
	title: string;
	person_id: string | null; // 성도 기념일(수술·입원 등)
	note: string | null;
}

// ---- 교육 (새가족 교육 등) ----
export interface EducationCourse {
	id: string;
	name: string;
}
export interface EducationRecord {
	id: string;
	person_id: string;
	course_id: string;
	start_date: string | null;
	end_date: string | null; // 수료일
	completed: boolean;
	instructor: string | null;
	note: string | null;
}

// ---- 교회 조직표 (위원회 / 부서) ----
export interface OrgUnit {
	id: string;
	parent_id: string | null;
	name: string;
	sort_order: number;
	leader_id: string | null; // 위원회는 위원장(장로), 실무부서는 담당자
}

export interface Affiliation {
	id: string;
	person_id: string;
	org: string; // 교회조직표의 부서 (복수 등록 가능)
	role: string | null;
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
