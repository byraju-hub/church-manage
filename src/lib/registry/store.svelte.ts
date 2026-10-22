// 프로토타입 저장소: 브라우저 localStorage. 실제 개발 시 Supabase 호출로 교체.
//
// [실제 시스템으로 옮길 때]
//  - 이 클래스의 조회·기록 메서드를 Supabase 질의로 바꿉니다. 화면은 registry.* 만 부르므로 화면 코드는 거의 그대로 둡니다.
//  - 권한(registry.perms)은 지금 브라우저에서만 확인합니다. 실제로는 로그인한 사용자의 권한을 DB 접근 규칙(RLS)으로
//    막아야 합니다. (예: 심방 표는 app_users.can_visit 인 사람만 select/insert)
//  - 접속기록·변경 이력은 화면이 아니라 DB 트리거나 서버 함수에서 남겨야 빠짐이 없습니다.
//  - 사진은 localStorage 가 아니라 Supabase Storage(비공개 버킷)에 두고, 교적에는 경로만 저장합니다.
//  - localStorage 는 브라우저마다 약 5MB 까지라 사진이 많으면 저장이 실패합니다. (아래 save() 에서 실패를 알림)
import * as seed from './seed.ts';
import type * as T from './types.ts';
import { categoryPath, currentFaith, currentOffice, currentStatus, officeTitle, registeredOn } from './derive.ts';
import { wasPresent, wasPresentGroup, sampleOthers } from './attendance.mock.ts';
import { isoDate, koreanHolidays, type CalItem } from './calendar.ts';
import { extractCareEvents, type CareEvent } from './care-events.ts';
import { MAX_CATEGORY_DEPTH, parseRank } from './types.ts';
import { groupOpinions } from './generate.ts';
import { defaultSettings, eduDeptFor, inRange, type YearSettings } from './year-settings.ts';
import { DEFAULT_BACKUP, DEFAULT_CERT, DEFAULT_CHURCH, DEFAULT_CODES, type BackupCfg, type CertForm, type ChurchInfo, type Codes } from './site-settings.ts';
import { ageCfg } from './age-mode.svelte.ts';
import { COMMUNITY_DEFS, catId, fixCat, type L2Code } from './config.ts';

const KEY = 'church-registry-proto-v16';

// 문자 자주 쓰는 문구. [ ] 안은 보낼 때 고쳐 쓰는 자리, {이름}·{직분} 은 받는 사람마다 바뀜
export interface SmsTemplate { id: string; title: string; body: string }
const DEFAULT_SMS_TEMPLATES: SmsTemplate[] = [
	{ id: 'sms-funeral', title: '장례 안내', body: '■ 부고 ■ 부평동부교회 [직분] [이름] 님께서 [날짜]에 소천하셨습니다.\n빈소: [장례식장] [호실]\n발인: [날짜] [시간]\n장지: [장지]\n유족들에게 주님의 위로가 함께하시길 기도해 주시기 바랍니다.' },
	{ id: 'sms-wedding', title: '결혼 안내', body: '■ 결혼 안내 ■ [직분] [이름] 님의 자녀 [신랑/신부 이름]의 결혼예배가 있습니다.\n일시: [날짜] [시간]\n장소: [예식장]\n많은 축복과 기도 부탁드립니다. - 부평동부교회' },
	{ id: 'sms-worship', title: '주일 예배 안내', body: '{이름} {직분}님, 이번 주일([날짜])은 [예배 내용]입니다. 함께 예배드려요. - 부평동부교회' },
	{ id: 'sms-birthday', title: '생일 축하', body: '{이름} {직분}님, 생일을 축하드립니다! 주님의 은혜와 평안이 늘 함께하시길 기도합니다. - 부평동부교회' },
	{ id: 'sms-visit', title: '심방 안내', body: '{이름} {직분}님, [날짜] [시간]에 [교역자] 목사님이 심방하려고 합니다. 괜찮으신지 회신 부탁드립니다. - 부평동부교회' }
];

// 교인 목록 일괄 수정 종류
export type BulkOp =
	| { kind: 'category'; category_id: string }
	| { kind: 'faith'; faith: T.FaithKind; date: string | null }
	| { kind: 'office'; office: T.OfficeName; rank: string; date: string | null; endOld: boolean }
	| { kind: 'group'; community: string; small_group: string };
const USER_KEY = 'reg-user';
const hasLS = typeof localStorage !== 'undefined';

interface Data {
	people: T.Person[];
	categories: T.Category[];
	households: T.Household[];
	householdMembers: T.HouseholdMember[];
	statusEvents: T.StatusEvent[];
	faithEvents: T.FaithEvent[];
	officeTerms: T.OfficeTerm[];
	personGroups: T.PersonGroup[];
	smallGroups: T.SmallGroup[];
	groupNotes: T.GroupNote[];
	notes: T.Note[];
	legacyMemos: T.LegacyMemo[];
	consents: T.Consent[];
	changeLog: T.ChangeLogEntry[];
	accessLog: T.AccessLogEntry[];
	visits: T.Visit[];
	affiliations: T.Affiliation[];
	events: T.ChurchEvent[];
	educationCourses: T.EducationCourse[];
	educationRecords: T.EducationRecord[];
	orgUnits: T.OrgUnit[];
	meetings: T.MeetingOfficer[];
	// 출석은 두 가지를 따로 저장 (소그룹에 속한 교인은 한 주일에 기록이 2개)
	attendance: Record<string, Record<string, T.AttendanceMark>>; // 1) 주일 오전예배 출석: 주일 날짜 → 사람 id
	worshipTotals?: Record<string, number>; // 1) 주일 오전예배 전체 출석 인원 (주일 날짜 → 인원). 명단 체크와 따로 입력
	groupAttendance?: Record<string, Record<string, T.AttendanceMark>>; // 2) 주일 오후 소그룹 모임 출석 (홈페이지 출석부에서 가져옴)
	smsTemplates?: SmsTemplate[]; // 문자 보내기의 자주 쓰는 문구 (모든 A 등급이 함께 씀)
	certRequests?: T.CertRequest[]; // 홈페이지에서 들어온 증명서 신청 (관리자 승인 후 직인 발급)
	yearSettings?: Record<string, YearSettings>; // 연간 설정 (연도 → 설정)
	churchInfo?: ChurchInfo; // 기본 설정: 교회 정보 · 로고 · 직인
	certForm?: CertForm; // 기본 설정: 증명서 양식
	codes?: Codes; // 기본 설정: 바꿀 수 있는 코드표 (심방 구분 · 전도회)
	backup?: BackupCfg; // 백업 설정
	communityNames?: Record<string, string>; // 공동체 이름 바꾼 것 (처음 이름 → 지금 이름)
	users: T.AppUser[];
	grades: T.GradeDef[];
}

// 가상 증명서 신청 3건 (홈페이지에서 들어온 것처럼). 시험용 인물(홍길동·성춘향·홍도령)만 씀
const sampleCertRequests = (): T.CertRequest[] => {
	const at = (daysBack: number, hm: string) => { const d = new Date(); d.setDate(d.getDate() - daysBack); return `${isoDate(d)} ${hm}`; };
	return [
		{ id: 'cr1', person_id: 'p1', kind: '교인증명서', purpose: '회사 제출용', requested_at: at(0, '09:12'), status: '대기', decided_at: null, decided_by: null },
		{ id: 'cr2', person_id: 'p2', kind: '세례증명서', purpose: '타 교회 직분 임직용', requested_at: at(1, '20:40'), status: '대기', decided_at: null, decided_by: null },
		{ id: 'cr3', person_id: 'p3', kind: '교인증명서', purpose: '장학금 신청용', requested_at: at(3, '14:05'), status: '승인', decided_at: at(2, '10:30'), decided_by: '정담임' }
	];
};
// 가상 부서 담당 교역자: 아직 아무 부서에도 교역자가 없으면, 담임목사를 뺀 교역자를 부서마다 돌아가며 한 명씩
function sampleOrgClergy(d: Data) {
	const depts = (d.orgUnits ?? []).filter((o) => o.parent_id);
	// 예전에 여러 명으로 저장한 값(clergy_ids)은 첫 사람만 남김
	for (const o of depts) { const old = (o as { clergy_ids?: string[] }).clergy_ids; if (old) { if (o.clergy_id === undefined) o.clergy_id = old[0] ?? null; delete (o as { clergy_ids?: string[] }).clergy_ids; } }
	if (!depts.length || depts.some((o) => o.clergy_id)) return;
	const clergy = (d.people ?? []).filter((p) => p.clergy_title && p.clergy_title !== '담임목사').map((p) => p.id);
	if (!clergy.length) return;
	depts.forEach((o, i) => { o.clergy_id = clergy[i % clergy.length]; });
}
const initial = (): Data => {
	const { generated, ...rest } = seed as unknown as Record<string, unknown>;
	void generated;
	const d = structuredClone(rest) as unknown as Data;
	d.certRequests = sampleCertRequests();
	sampleOrgClergy(d);
	return d;
};
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const today = () => isoDate(new Date());
const uid = () => crypto.randomUUID();

// 예전에 저장한 데이터 고치기: 등급 1·2·3 → C·B·A (3등급 교역자 = A 전임 교역자, 2등급 = B 교적 관리, 1등급 = C 열람)
function migrate(d: Data): Data {
	const map: Record<number, T.Grade> = { 1: 'C', 2: 'B', 3: 'A' };
	if (d.grades?.some((g) => typeof g.grade === 'number')) {
		d.grades = structuredClone((seed as unknown as { grades: T.GradeDef[] }).grades);
		for (const u of d.users ?? []) if (typeof u.grade === 'number') u.grade = map[u.grade as number] ?? 'C';
	}
	// 미등록/타교인을 1단계로 줄임: 예전 'o.장년.예배출석' 같은 하위 구분을 지우고 'o' 로
	if (d.categories?.some((c) => c.id.startsWith('o.'))) {
		d.categories = d.categories.filter((c) => !c.id.startsWith('o.'));
		for (const p of d.people ?? []) if (p.category_id?.startsWith('o.')) p.category_id = 'o';
	}
	// '불출석'은 장년에만: 다른 2단계의 불출석을 지우고, 그 교인은 장기결석자로
	if (d.categories?.some((c) => /^m\.[^a]\.n$/.test(c.id))) {
		d.categories = d.categories.filter((c) => !/^m\.[^a]\.n$/.test(c.id));
		for (const p of d.people ?? []) p.category_id = fixCat(p.category_id);
	}
	if (!d.certRequests) d.certRequests = sampleCertRequests();
	sampleOrgClergy(d);
	// 소그룹 '기타 의견'(교인 없이 모임 전체에 대한 의견) 샘플이 없으면 넣어 둠
	if (d.groupNotes && !d.groupNotes.some((n) => !n.person_id)) {
		const nm = (id: string) => d.people?.find((p) => p.id === id)?.name ?? '';
		d.groupNotes.push(...groupOpinions(d.smallGroups ?? [], nm));
		d.groupNotes.sort((a, b) => b.date.localeCompare(a.date));
	}
	// 일정 종류 이름 바꿈: '교회 기념일' → '교회 절기'
	for (const e of d.events ?? []) {
		if ((e.kind as string) === '교회 기념일') e.kind = '교회 절기';
		if ((e.kind as string) === '성도 기념일') e.kind = '성도';
		// 특별 주일·창립기념은 사역 일정으로
		if (e.kind === '교회 절기' && /어린이주일|어버이주일|창립/.test(e.title)) e.kind = '사역 일정';
	}
	return d;
}

function load(): Data {
	if (hasLS) {
		// 데이터 구조가 바뀔 때마다 KEY 번호를 올리는데, 예전 번호의 데이터(한 벌에 약 1~2MB)가 남아 있으면
		// 브라우저 저장 공간(약 5MB)이 금방 차서 저장이 안 됨. 지금 KEY 가 아닌 예전 데이터는 지움
		try {
			for (const k of Object.keys(localStorage)) if ((k.startsWith('church-registry-proto-') && k !== KEY) || k === 'church-registry-perms-v1') localStorage.removeItem(k);
		} catch {}
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) return migrate(JSON.parse(raw));
		} catch {}
	}
	return initial();
}
function loadUser(): string {
	try { return sessionStorage.getItem(USER_KEY) ?? ''; } catch { return ''; }
}
const NO_PERMS: T.Perms = { edit: false, export: false, visit: false, admin: false };

const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

class Registry {
	d = $state<Data>(load());
	userId = $state<string>(loadUser());
	saveError = $state('');
	constructor() {
		// 올해 연간 설정의 나이 계산 방식을 화면 전체에 적용
		ageCfg.mode = this.settingsFor(new Date().getFullYear()).ageMode;
	}

	private save() {
		if (!hasLS) return;
		try {
			localStorage.setItem(KEY, JSON.stringify(this.d));
			this.saveError = '';
		} catch {
			// 브라우저 저장 공간(약 5MB)이 차면 여기로 옴. 실제 시스템에서는 DB에 저장하므로 생기지 않는 문제
			this.saveError = '브라우저 저장 공간이 가득 차 방금 입력한 내용을 저장하지 못했습니다. 사진을 줄이거나 ‘교적 데이터 초기화’를 해 주세요.';
		}
	}

	// ---- 회원·권한 ----
	// 지금 로그인한 회원. 승인(사용) 상태여야 교적을 볼 수 있음. 권한은 등급에서 오고, 최고관리자는 모든 권한
	get me(): T.AppUser | undefined { return this.d.users.find((u) => u.id === this.userId); }
	gradeDef(g: T.Grade | null | undefined) { return this.d.grades.find((x) => x.grade === g); }
	permsOf(u: T.AppUser | undefined): T.Perms {
		if (!u || u.status !== '사용') return NO_PERMS;
		// 심방(심방 메뉴·기록, 소그룹 특이사항, 디모데 메모)은 A 등급만. 등급 설정이나 최고관리자 여부와 관계없이 고정
		const visit = u.grade === 'A';
		if (u.is_super) return { edit: true, export: true, visit, admin: true };
		const p = this.gradeDef(u.grade)?.perms ?? NO_PERMS;
		return { ...p, visit };
	}
	get perms(): T.Perms { return this.permsOf(this.me); }
	get isSuper(): boolean { return !!this.me?.is_super && this.me.status === '사용'; }

	// ---- 공동체 (1단계) 목록과 이름 바꾸기 ----
	// 공동체 순서·출생 연도 기준은 COMMUNITY_DEFS, 이름은 관리자가 바꾼 값
	get communities() { return COMMUNITY_DEFS.map((c) => ({ ...c, key: c.name, name: this.d.communityNames?.[c.name] ?? c.name })); }
	communityKey(name: string): string { return this.communities.find((c) => c.name === name)?.key ?? name; }
	renameCommunity(oldName: string, newName: string): string {
		const nn = newName.trim();
		if (!this.canSetup) return '권한이 없습니다.';
		if (!nn || nn === oldName) return '';
		if (this.communities.some((c) => c.name === nn)) return '같은 이름이 이미 있습니다.';
		const key = this.communityKey(oldName);
		this.d.communityNames = { ...(this.d.communityNames ?? {}), [key]: nn };
		for (const g of this.d.smallGroups) if (g.community === oldName) g.community = nn;
		for (const pg of this.d.personGroups) if (pg.community === oldName) pg.community = nn;
		for (const ys of Object.values(this.d.yearSettings ?? {})) if (ys.communities[oldName]) { ys.communities[nn] = ys.communities[oldName]; delete ys.communities[oldName]; }
		this.log('설정', `${this.t1} 이름 바꿈: ${oldName} → ${nn}`);
		return '';
	}
	// 교회마다 부르는 이름: 1단계(공동체·교구·지역…), 2단계(소그룹·구역·목장·셀…)
	get t1(): string { return this.churchInfo.unit1 || '공동체'; }
	get t2(): string { return this.churchInfo.unit2 || '소그룹'; }
	// 화면 글의 '공동체'·'소그룹'을 고른 이름으로 (탭·칸 이름처럼 값으로도 쓰는 글자를 보여 줄 때)
	tr(s: string): string { return s.replaceAll('공동체', this.t1).replaceAll('소그룹', this.t2); }
	// 받침에 맞는 조사: josa('교구', '을') → '를', josa('지역', '을') → '을'
	josa(word: string, withBatchim: '을' | '이' | '은' | '과' | '으로'): string {
		const pairs = { 을: '를', 이: '가', 은: '는', 과: '와', 으로: '로' } as const;
		const c = word.charCodeAt(word.length - 1) - 0xac00;
		const has = c >= 0 && c <= 11171 && c % 28 !== 0;
		return has && !(withBatchim === '으로' && c % 28 === 8) ? withBatchim : pairs[withBatchim];
	}
	// '뿌리 공동체' → '뿌리' (표처럼 좁은 칸에 쓸 때)
	short(comm: string): string { return comm.replace(new RegExp(`\\s*(${this.t1}|공동체)$`), ''); }

	// ---- 기본 설정 · 백업 ----
	get churchInfo(): ChurchInfo { return { ...DEFAULT_CHURCH, ...(this.d.churchInfo ?? {}) }; }
	get certForm(): CertForm { return { ...DEFAULT_CERT, ...(this.d.certForm ?? {}) }; }
	get codes(): Codes { return { ...DEFAULT_CODES, ...(this.d.codes ?? {}) }; }
	get backupCfg(): BackupCfg { return { ...DEFAULT_BACKUP, ...(this.d.backup ?? {}) }; }
	get canSetup(): boolean { return this.isSuper || this.perms.admin; }
	saveSite(part: { churchInfo?: ChurchInfo; certForm?: CertForm; codes?: Codes; backup?: BackupCfg }, what: string) {
		if (!this.canSetup) return;
		for (const [k, v] of Object.entries(part)) (this.d as unknown as Record<string, unknown>)[k] = structuredClone($state.snapshot(v));
		this.log('설정', what);
	}
	// 지금 담임목사 이름 (기본 설정에 적은 이름이 먼저, 없으면 교적의 담임목사)
	get pastorName(): string { return this.churchInfo.pastorName || this.d.people.find((p) => p.clergy_title === '담임목사')?.name || ''; }
	// 백업: 지금 데이터 전체를 파일로 / 파일에서 되살리기 (최고관리자만)
	backupJson(): string {
		const b = { ...this.backupCfg, last: now() };
		this.d.backup = b;
		this.log('백업', '데이터 전체 내려받기');
		return JSON.stringify({ app: 'church-registry', version: KEY, at: now(), data: $state.snapshot(this.d) });
	}
	restoreJson(text: string): string {
		if (!this.isSuper) return '최고관리자만 되살릴 수 있습니다.';
		try {
			const o = JSON.parse(text);
			if (o?.app !== 'church-registry' || !o.data?.people) return '이 교적 프로그램의 백업 파일이 아닙니다.';
			this.d = migrate(o.data as Data);
			this.log('백업', `백업 파일로 되살림 (${o.at ?? '날짜 모름'})`);
			return '';
		} catch {
			return '파일을 읽지 못했습니다.';
		}
	}

	// ---- 연간 설정 ----
	// 저장된 연도 설정이 없으면 기본값(2026년 기준을 그 해에 맞춘 값)
	settingsFor(year: number): YearSettings { return this.d.yearSettings?.[year] ?? defaultSettings(year); }
	get ys(): YearSettings { return this.settingsFor(new Date().getFullYear()); }
	saveYearSettings(s: YearSettings) {
		if (!this.isSuper && !this.perms.admin) return;
		this.d.yearSettings = { ...(this.d.yearSettings ?? {}), [s.year]: structuredClone($state.snapshot(s)) as YearSettings };
		if (s.year === new Date().getFullYear()) ageCfg.mode = s.ageMode;
		this.log('설정', `${s.year}년 연간 설정 저장`);
	}
	// 공동체·전도회 기준(출생 연도)과 맞지 않는 교인
	communityMismatch(s = this.ys) {
		return this.d.people.map((p) => ({ p, s: this.summary(p) })).filter(({ p, s: x }) => {
			const r = x.community && s.communities[x.community];
			return !!r && !!p.birth_date && !inRange(+p.birth_date.slice(0, 4), r) && x.memberCert;
		});
	}
	societyMismatch(s = this.ys) {
		return this.d.people.filter((p) => {
			const r = p.mission_society && s.societies[p.mission_society];
			return !!r && !!p.birth_date && !inRange(+p.birth_date.slice(0, 4), r) && this.summary(p).memberCert;
		});
	}
	// 교육부서 이동(진급) 대상: 교인 › (교육부서·청년부) 중 학교 나이 기준과 지금 부서가 다른 사람
	eduMoves(s = this.ys) {
		const EDU = ['영아부', '유치부', '유초등부', '중고등부', '청년부'];
		return this.d.people.map((p) => ({ p, s: this.summary(p) }))
			.filter(({ p, s: x }) => x.memberCert && x.cat1 === '교인' && EDU.includes(x.cat2) && !!p.birth_date)
			.map(({ p, s: x }) => ({ p, from: x.cat2, to: eduDeptFor(+p.birth_date!.slice(0, 4), s) }))
			.filter((m) => m.to && m.to !== m.from) as { p: T.Person; from: string; to: string }[];
	}
	applyEduMoves(list: { p: T.Person; to: string }[]) {
		if (!this.isSuper && !this.perms.admin) return 0;
		const CODE: Record<string, L2Code> = { 장년: 'a', 청년부: 'y', 중고등부: 'h', 유초등부: 'e', 유치부: 'k', 영아부: 'b' };
		let n = 0;
		for (const { p, to } of list) {
			const l3 = (p.category_id?.split('.')[2] ?? 'a') as 'a' | 's' | 'n' | 'l';
			const code = CODE[to];
			if (!code) continue;
			this.updatePerson(p.id, { category_id: catId('m', code, l3), edu_dept: to === '장년' ? null : (to as T.EduDept) });
			n++;
		}
		this.log('설정', `교육부서 이동 ${n}명`);
		return n;
	}

	// ---- 홈페이지 증명서 신청 ----
	// [실제 시스템] 홈페이지(교인 로그인)에서 신청하면 cert_requests 표에 '대기'로 들어오고,
	//   관리자가 승인한 신청만 직인이 들어간 PDF를 만들어 홈페이지에서 내려받게 합니다. 직인 이미지는 공개 저장소가 아닌
	//   로그인한 관리자만 읽을 수 있는 저장소(예: Supabase Storage 비공개 버킷)에 둡니다.
	get certRequests(): T.CertRequest[] { return this.d.certRequests ?? []; }
	get canApproveCert(): boolean { return this.isSuper || this.perms.admin; }
	decideCertRequest(id: string, approve: boolean) {
		const r = this.d.certRequests?.find((x) => x.id === id);
		if (!r || !this.canApproveCert) return;
		r.status = approve ? '승인' : '반려';
		r.decided_at = now();
		r.decided_by = this.who;
		this.log('증명서 신청', `${approve ? '승인' : '반려'} · ${r.kind} · ${this.person(r.person_id)?.name ?? ''} · ${r.purpose}`);
	}
	private get who(): string { return this.me?.name ?? '알 수 없음'; }
	login(id: string) {
		this.userId = id;
		try { sessionStorage.setItem(USER_KEY, id); } catch {}
		this.log('로그인 (카카오)', this.me?.name ?? '');
	}
	logout() {
		this.userId = '';
		try { sessionStorage.removeItem(USER_KEY); } catch {}
	}
	// 카카오로 처음 로그인하면 '승인 대기' 회원이 됨. 최고관리자가 승인하고 등급을 정하기 전에는 아무것도 볼 수 없음
	// [실제 시스템] auth.users 에 사람이 생길 때 트리거로 만듭니다. (이름·이메일은 카카오 동의 항목에서)
	signUpKakao(name: string, nickname: string, email: string, phone: string) {
		const id = uid();
		this.d.users.push({
			id, name: name.trim(), provider: '카카오', kakao_nickname: nickname.trim() || name.trim(), email: email.trim() || null, phone: phone.trim() || null,
			person_id: null, status: '승인 대기', grade: null, is_super: false, requested_at: today(), decided_at: null, decided_by: null, note: null
		});
		this.save();
		return id;
	}
	// 아래는 최고관리자만 (실제 시스템에서는 서버·RLS에서 다시 확인)
	approveUser(id: string, grade: T.Grade) {
		const u = this.d.users.find((x) => x.id === id);
		if (!u || !this.isSuper) return;
		u.status = '사용'; u.grade = grade; u.decided_at = today(); u.decided_by = this.who;
		this.log(`회원 승인 (${this.gradeDef(grade)?.name})`, u.name);
	}
	setUserGrade(id: string, grade: T.Grade) {
		const u = this.d.users.find((x) => x.id === id);
		if (!u || !this.isSuper) return;
		u.grade = grade;
		this.log(`등급 변경 → ${this.gradeDef(grade)?.name}`, u.name);
	}
	setUserStatus(id: string, status: T.UserStatus) {
		const u = this.d.users.find((x) => x.id === id);
		if (!u || !this.isSuper || u.id === this.userId) return;
		u.status = status; u.decided_at = today(); u.decided_by = this.who;
		if (status === '사용' && !u.grade) u.grade = 'C';
		this.log(`회원 ${status === '사용' ? '사용 재개' : status}`, u.name);
	}
	setGradePerm(grade: T.Grade, key: keyof T.Perms, value: boolean) {
		const g = this.gradeDef(grade);
		if (!g || !this.isSuper || key === 'visit') return;
		g.perms[key] = value;
		this.log(`등급 권한 ${value ? '부여' : '해제'}: ${({ edit: '수정', export: '내려받기·출력', visit: '심방', admin: '사이트 관리자' } as const)[key]}`, g.name);
	}
	renameGrade(grade: T.Grade, name: string) {
		const g = this.gradeDef(grade);
		if (g && this.isSuper && name.trim()) { g.name = name.trim(); this.save(); }
	}
	setUserSuper(id: string, value: boolean) {
		const u = this.d.users.find((x) => x.id === id);
		if (!u || !this.isSuper || (u.id === this.userId && !value)) return;
		u.is_super = value;
		this.log(value ? '최고관리자 지정' : '최고관리자 해제', u.name);
	}
	linkUserPerson(id: string, person_id: string | null) {
		const u = this.d.users.find((x) => x.id === id);
		if (u && this.isSuper) { u.person_id = person_id; this.save(); }
	}
	removeUser(id: string) {
		if (!this.isSuper || id === this.userId) return;
		this.d.users = this.d.users.filter((u) => u.id !== id);
		this.save();
	}
	reset() {
		this.d = initial();
		this.save();
	}

	// ---- 조회 ---- (1,000명 규모에서도 빠르도록 사람 번호별 색인을 한 번만 만듦)
	private idx = $derived.by(() => {
		const by = <X>(xs: X[], key: (x: X) => string | null) => {
			const m = new Map<string, X[]>();
			for (const x of xs) { const k = key(x); if (k) { const l = m.get(k); if (l) l.push(x); else m.set(k, [x]); } }
			return m;
		};
		return {
			people: new Map(this.d.people.map((p) => [p.id, p])),
			status: by(this.d.statusEvents, (e) => e.person_id),
			faith: by(this.d.faithEvents, (e) => e.person_id),
			offices: by(this.d.officeTerms, (e) => e.person_id),
			groups: new Map(this.d.personGroups.map((g) => [g.person_id, g])),
			members: new Map(this.d.householdMembers.filter((m) => m.person_id).map((m) => [m.person_id!, m]))
		};
	});
	private static none: never[] = [];
	person(id: string) { return this.idx.people.get(id); }
	statusOf(id: string): T.StatusEvent[] { return this.idx.status.get(id) ?? Registry.none; }
	faithOf(id: string): T.FaithEvent[] { return this.idx.faith.get(id) ?? Registry.none; }
	officesOf(id: string): T.OfficeTerm[] { return this.idx.offices.get(id) ?? Registry.none; }
	groupOf(id: string) { return this.idx.groups.get(id); }
	memberOf(personId: string) { return this.idx.members.get(personId); }
	householdOf(personId: string) {
		const m = this.memberOf(personId);
		return m ? this.d.households.find((h) => h.id === m.household_id) : undefined;
	}
	membersOfHousehold(hid: string) {
		return this.d.householdMembers.filter((m) => m.household_id === hid).sort((a, b) => a.sort_order - b.sort_order);
	}
	// 교인구분: 경로 ['교인','장년','예배출석'] 와 단계별 이름
	categoryOf(p: T.Person) {
		const path = categoryPath(this.d.categories, p.category_id);
		return { path, l1: path[0]?.name ?? '', l2: path[1]?.name ?? '', l3: path[2]?.name ?? '', label: path.map((c) => c.name).join(' › ') };
	}
	childrenOf(parentId: string | null) {
		return this.d.categories.filter((c) => c.parent_id === parentId).sort((a, b) => a.sort_order - b.sort_order);
	}
	groupDef(name: string) { return this.d.smallGroups.find((g) => g.name === name); }
	membersOfGroup(smallGroup: string) {
		return this.d.personGroups.filter((g) => g.small_group === smallGroup).map((g) => this.person(g.person_id)!).filter(Boolean);
	}

	// 카드에 보이는 '지금 값' (이력에서 계산)
	summary(p: T.Person) {
		const events = this.statusOf(p.id);
		const st = currentStatus(events);
		const office = currentOffice(this.officesOf(p.id));
		const g = this.groupOf(p.id);
		const cat = this.categoryOf(p);
		return {
			status: events.length ? st.label : '미등록',
			statusKind: st.status,
			memberCert: st.memberCert,
			faith: currentFaith(this.faithOf(p.id), p),
			office,
			title: office ? officeTitle(office) : '',
			registered: registeredOn(events),
			community: g?.community ?? '',
			smallGroup: g?.small_group ?? '',
			category: cat.label,
			cat1: cat.l1, cat2: cat.l2, cat3: cat.l3
		};
	}

	// ---- 출석 ----
	// 출석은 두 가지가 따로 있습니다.
	//  1) 주일 오전예배 출석: 교적 프로그램 '출석' 화면에서 등록 (attended)
	//  2) 주일 오후 소그룹 모임 출석: 홈페이지 출석부에서 소그룹 인도자가 등록 (groupAttended)
	// [실제 시스템] groupAttended 는 홈페이지 출석부 조회로 바꾸세요.
	// 소그룹 모임 출석: 저장된 기록(홈페이지 출석부에서 가져온 것)이 있으면 그것을, 없으면 가상 샘플
	groupAttended(personId: string, sundayIso: string, weeksFromEnd: number): boolean {
		const mark = this.d.groupAttendance?.[sundayIso]?.[personId];
		return mark ? mark.present : wasPresentGroup(personId, sundayIso, weeksFromEnd);
	}
	groupAttendanceMark(personId: string, sundayIso: string) { return this.d.groupAttendance?.[sundayIso]?.[personId]; }
	// 홈페이지 출석부 기록을 받아 저장하는 자리 (교적 화면에서는 직접 입력하지 않음)
	setGroupAttendance(sundayIso: string, personId: string, present: boolean, reason: string | null) {
		const all = { ...(this.d.groupAttendance ?? {}) };
		all[sundayIso] = { ...(all[sundayIso] ?? {}), [personId]: { present, reason } };
		this.d.groupAttendance = all;
		this.save();
	}
	// 주일 오전예배: 이번에 직접 입력한 값이 있으면 그것을, 없으면 가상 샘플을 따름
	attended(personId: string, sundayIso: string, weeksFromEnd: number): boolean {
		const mark = this.d.attendance[sundayIso]?.[personId];
		return mark ? mark.present : wasPresent(personId, sundayIso, weeksFromEnd);
	}
	attendanceMark(personId: string, sundayIso: string) { return this.d.attendance[sundayIso]?.[personId]; }
	setAttendance(sundayIso: string, personId: string, present: boolean, reason: string | null) {
		if (!this.d.attendance[sundayIso]) this.d.attendance[sundayIso] = {};
		this.d.attendance[sundayIso][personId] = { present, reason };
		this.save();
	}
	// 주일 오전예배 출석 명단: 재적 교인 중 소그룹에 속한 사람 + 소그룹이 없는 장년 ('출석' 화면 명단과 같음)
	worshipRoster(): T.Person[] {
		return this.d.people.filter((p) => { const s = this.summary(p); return s.memberCert && (!!s.smallGroup || s.cat2 === '장년'); });
	}
	// 주일 오전예배 전체 출석 인원: 직접 입력한 값, 없으면 (명단 체크 인원 + 가상 '그 외' 샘플)
	worshipTotal(sundayIso: string, checked: number): number {
		return this.d.worshipTotals?.[sundayIso] ?? checked + sampleOthers(sundayIso);
	}
	worshipTotalSaved(sundayIso: string): number | undefined { return this.d.worshipTotals?.[sundayIso]; }
	setWorshipTotal(sundayIso: string, n: number | null) {
		const m = { ...(this.d.worshipTotals ?? {}) };
		if (n === null) delete m[sundayIso]; else m[sundayIso] = n;
		this.d.worshipTotals = m;
		this.log('주일 출석 인원 입력', `${sundayIso} ${n ?? '지움'}`);
	}

	// ---- 검색 (대시보드 검색창: 무엇이든) ----
	// 교인 한 사람에 대해 '무엇이든' 찾을 글 (대시보드 통합 검색 · 교인 목록 기본 검색이 함께 씀)
	personHay(p: T.Person): string {
		const s = this.summary(p);
		const hh = this.householdOf(p.id);
		return [p.name, p.name_note, p.phone, p.address1, p.address2, hh?.address, hh?.no, p.occupation, p.workplace, p.car_number, p.note, p.previous_church, p.reg_no, p.email, s.title, s.status, s.faith,
			s.community, s.smallGroup, s.category, p.mission_society, p.edu_dept, p.clergy_title, p.guide_name, p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : ''].filter(Boolean).join(' ').toLowerCase();
	}
	// 낱말을 띄어 쓰면 모두 들어 있는 사람만 (숫자 3자리 이상은 전화·차량 번호처럼 숫자만 비교)
	matcher(q: string): ((hay: string) => boolean) | null {
		const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
		if (!terms.length) return null;
		const digits = (s: string) => s.replace(/\D/g, '');
		return (hay: string) => terms.every((t) => hay.includes(t) || (digits(t).length >= 3 && digits(hay).includes(digits(t))));
	}
	search(q: string) {
		const empty = { people: [] as T.Person[], groups: [] as T.SmallGroup[], households: [] as T.Household[], visits: [] as T.Visit[], notes: [] as { p: T.Person; body: string; kind: string }[], orgs: [] as T.OrgUnit[], total: 0 };
		const hit = this.matcher(q);
		if (!hit) return empty;
		const people: T.Person[] = [];
		let total = 0;
		for (const p of this.d.people) {
			if (hit(this.personHay(p))) { total++; if (people.length < 8) people.push(p); }
		}
		const groups = this.d.smallGroups.filter((g) => hit(`${g.community} ${g.name} ${g.place ?? ''} ${this.person(g.leader_id ?? '')?.name ?? ''}`.toLowerCase())).slice(0, 6);
		const households = this.d.households.filter((h) => hit(`${h.no} ${h.address ?? ''} ${h.home_phone ?? ''}`.toLowerCase())).slice(0, 5);
		const visits = this.perms.visit ? this.d.visits.filter((v) => hit(`${v.content} ${v.kind} ${v.pastor} ${v.scripture ?? ''} ${v.follow_up ?? ''} ${this.person(v.person_id)?.name ?? ''}`.toLowerCase())).slice(0, 5) : [];
		const notes: { p: T.Person; body: string; kind: string }[] = [];
		for (const n of this.d.notes) if (hit(n.body.toLowerCase())) { const p = this.person(n.person_id); if (p) notes.push({ p, body: n.body, kind: '담당자 메모' }); if (notes.length >= 4) break; }
		// 인도자 특이사항은 건강 등 민감한 내용이 있어 심방 권한자만
		if (this.perms.visit) for (const n of this.d.groupNotes) if (notes.length < 6 && hit(`${n.body} ${n.small_group}`.toLowerCase())) { const p = n.person_id ? this.person(n.person_id) : undefined; if (p) notes.push({ p, body: n.body, kind: `인도자 특이사항 · ${n.small_group}` }); }
		const orgs = this.d.orgUnits.filter((o) => hit(o.name.toLowerCase())).slice(0, 5);
		return { people, groups, households, visits, notes, orgs, total };
	}

	// ---- 캘린더 (달 단위) ----
	// [실제 시스템] 음력 생일은 해마다 양력 날짜가 바뀝니다. 지금은 같은 월·일에 '음력' 표시만 합니다.
	//   한국천문연구원 음양력 정보 API(공공데이터포털) 또는 음력 변환 라이브러리로 그해의 양력 날짜를 구해 표시하세요.
	//   (생일 명단·대시보드·문서 출력의 생일도 같은 변환을 써야 합니다)
	calendarItems(year: number, month: number, kinds: Set<string>): CalItem[] {
		const out: CalItem[] = [];
		const mm = String(month).padStart(2, '0');
		const last = new Date(year, month, 0).getDate();
		const nameOf = (id: string | null | undefined) => (id ? this.person(id)?.name ?? '' : '');
		// [샘플 전용] 가상 데이터가 많아 달력이 빽빽하므로, 생일·심방·가상 일정은 3분의 1만 보여 줍니다.
		//   실제 시스템에서는 이 거르기(sample)를 빼세요. 직접 등록한 일정은 거르지 않습니다.
		const sample = (key: string) => {
			let h = 0;
			for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0;
			return Math.abs(h) % 3 === 0;
		};
		if (kinds.has('생일')) {
			for (const p of this.d.people) {
				if (!sample(p.id)) continue;
				if (!this.statusOf(p.id).length) continue;
				const s = this.summary(p);
				if (!s.memberCert) continue;
				if (p.birth_date && p.birth_date.slice(5, 7) === mm) {
					const d = Math.min(+p.birth_date.slice(8, 10), last);
					out.push({ date: `${year}-${mm}-${String(d).padStart(2, '0')}`, kind: '생일', title: `${p.name}${s.title ? ' ' + s.title : ''}`, sub: p.birth_lunar ? '음력 생일' : '양력 생일', person_id: p.id, href: `/${p.id}` });
				}
			}
		}
		const monthStart = `${year}-${mm}-01`, monthEnd = `${year}-${mm}-${String(last).padStart(2, '0')}`;
		// 한국 공휴일 (계산값, 저장하지 않음). 성탄절은 교회 절기로도 나오므로 공휴일 줄은 빼고 날짜만 빨갛게
		if (kinds.has('공휴일'))
			for (const h of koreanHolidays(year)) if (h.date >= monthStart && h.date <= monthEnd && h.title !== '성탄절') out.push({ date: h.date, kind: '공휴일', title: h.title.replace(/ · 성탄절|성탄절 · /, '') });
		for (const e of this.d.events) {
			if (!kinds.has(e.kind)) continue;
			const end = e.end_date ?? e.date;
			if (end < monthStart || e.date > monthEnd) continue;
			// 가상으로 만든 반복 일정(대청소·기도회·당회 등)과 성도만 거름. 교회 절기·성례는 그대로
			if (/^ev\d+$/.test(e.id) && (e.kind === '사역 일정' || e.kind === '성도') && !sample(e.id)) continue;
			const who = nameOf(e.person_id);
			out.push({ date: e.date, end_date: e.end_date, kind: e.kind, title: who ? `${who} ${e.title}` : e.title, sub: e.note ?? undefined, event_id: e.id, person_id: e.person_id, href: e.person_id ? `/${e.person_id}` : undefined });
		}
		// 달력의 심방 계획(이름·날짜)은 모든 회원에게 보임. 심방 내용은 A 등급만 (심방 메뉴·교적 카드)
		if (kinds.has('심방 계획')) {
			for (const v of this.d.visits) {
				if (v.visit_date < monthStart || v.visit_date > monthEnd) continue;
				if (!sample(v.id)) continue;
				const g = this.groupOf(v.person_id);
				out.push({ date: v.visit_date, kind: '심방 계획', title: `${nameOf(v.person_id)} ${v.kind} 심방`, sub: `${v.method} · ${v.pastor}${g ? ' · ' + g.community : ''}`, person_id: v.person_id, href: `/${v.person_id}` });
			}
		}
		return out;
	}

	// 세례식 대상: 학습을 받고 아직 세례(입교)를 받지 않은 재적 교인
	baptismCandidates() {
		return this.d.people
			.map((p) => ({ p, s: this.summary(p) }))
			.filter(({ s }) => s.memberCert && s.faith === '학습교인');
	}

	// ---- 기록 ----
	log(action: string, target: string) {
		this.d.accessLog.unshift({ id: uid(), at: now(), who: this.who, action, target });
		if (this.d.accessLog.length > 500) this.d.accessLog.length = 500;
		this.save();
	}

	updatePerson(id: string, patch: Partial<T.Person>) {
		const p = this.person(id);
		if (!p) return;
		for (const [k, v] of Object.entries(patch)) {
			const before = (p as any)[k];
			if (fmt(before) === fmt(v)) continue;
			if (k === 'photo') this.d.changeLog.unshift({ id: uid(), person_id: id, at: now(), by: this.who, field: '사진', before: before ? '(있음)' : null, after: v ? '(변경)' : null });
			else if (k === 'category_id') this.d.changeLog.unshift({ id: uid(), person_id: id, at: now(), by: this.who, field: '교인구분', before: this.catLabel(before), after: this.catLabel(v as string | null) });
			else this.d.changeLog.unshift({ id: uid(), person_id: id, at: now(), by: this.who, field: k, before: fmt(before), after: fmt(v) });
			(p as any)[k] = v;
		}
		this.log('수정', p.name);
	}
	private catLabel(id: string | null) { return categoryPath(this.d.categories, id).map((c) => c.name).join(' › ') || null; }

	private change(person_id: string, field: string, after: string) {
		this.d.changeLog.unshift({ id: uid(), person_id, at: now(), by: this.who, field, before: null, after });
	}
	addStatus(e: Omit<T.StatusEvent, 'id'>) {
		this.d.statusEvents.push({ ...e, id: uid() });
		this.syncCategory(e.person_id, e.kind);
		this.change(e.person_id, '재적 이력', `${e.kind} ${e.event_date ?? '(날짜 미상)'}`);
		this.log('수정', this.person(e.person_id)?.name ?? '');
	}
	// 재적 이력이 기준: 이력을 남기면 교인구분 1단계를 자동으로 맞춤
	//  별세 → 별세, 전출 → 이사/이민, 제적·보관 → 보관, 보류 → 3단계 '불출석', 등록·전입·복적 → 교인(장년·예배출석)
	// [실제 시스템] DB 트리거로 같은 규칙을 적용합니다. (카테고리 id 'dead'·'move'·'keep'·'m.a.a' 는 지우지 못하게 고정)
	private syncCategory(person_id: string, kind: T.StatusKind) {
		const p = this.person(person_id);
		if (!p) return;
		const cur = p.category_id ?? '';
		const gone: Partial<Record<T.StatusKind, string>> = { 별세: 'dead', 전출: 'move', 제적: 'keep', 보관: 'keep' };
		let next = cur;
		if (gone[kind]) next = gone[kind]!;
		else if (kind === '보류' && cur.startsWith('m.')) next = fixCat(cur.replace(/\.[asnl]$/, '.n'))!; // 장년이 아니면 장기결석자
		else if (kind === '등록' || kind === '전입' || kind === '복적') {
			if (cur === 'o') next = 'm.n.a'; // 미등록/타교인이 등록하면 교인 › 새가족 › 예배출석
			else if (!cur.startsWith('m.')) next = 'm.a.a';
		}
		if (next !== cur && this.d.categories.some((c) => c.id === next)) {
			this.d.changeLog.unshift({ id: uid(), person_id, at: now(), by: this.who, field: '교인구분(자동)', before: this.catLabel(cur || null), after: this.catLabel(next) });
			p.category_id = next;
		}
	}

	// 동명이인 구분: 같은 이름이 둘 이상이면 등록 순서대로 A, B, C … 를 붙임 (이미 붙은 글자는 그대로 둠)
	assignNameNotes(name: string) {
		const same = this.d.people.filter((p) => p.name === name);
		if (same.length < 2) return;
		const order = (p: T.Person) => registeredOn(this.statusOf(p.id)) ?? '9999';
		const used = new Set(same.map((p) => p.name_note).filter(Boolean));
		const letters = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).filter((l) => !used.has(l));
		for (const p of [...same].sort((a, b) => order(a).localeCompare(order(b)))) {
			if (!p.name_note) { p.name_note = letters.shift() ?? null; }
		}
	}
	nextNameNote(name: string): string | null {
		const same = this.d.people.filter((p) => p.name === name.trim());
		if (!same.length) return null;
		const used = new Set(same.map((p) => p.name_note).filter(Boolean));
		// 지금 글자가 없는 기존 교인들이 먼저 글자를 받고, 새로 등록하는 사람은 그 다음 글자
		const free = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)).filter((l) => !used.has(l));
		return free[same.filter((p) => !p.name_note).length] ?? null;
	}

	addFaith(e: Omit<T.FaithEvent, 'id'>) {
		this.d.faithEvents.push({ ...e, id: uid() });
		this.change(e.person_id, '신급 이력', `${e.kind} ${e.event_date ?? '(날짜 미상)'}`);
		this.log('수정', this.person(e.person_id)?.name ?? '');
	}
	addOffice(e: Omit<T.OfficeTerm, 'id'>) {
		this.d.officeTerms.push({ ...e, id: uid() });
		this.change(e.person_id, '직분 이력', `${e.office} ${e.rank_status} ${e.start_date ?? '(날짜 미상)'}${e.church ? ` · ${e.church}` : ''}`);
		this.log('수정', this.person(e.person_id)?.name ?? '');
	}
	// ---- 일괄 수정: 교인 목록에서 고른 여러 사람을 한 번에 ----
	// 사람마다 변경 이력은 그대로 남기고, 저장과 접속기록은 한 번만. 바뀐 사람 수를 돌려줌
	bulkEdit(ids: string[], op: BulkOp): number {
		if (!this.isSuper) return 0; // 일괄 수정은 최고관리자만 ([실제 시스템] 서버에서도 같은 확인)
		const today = new Date().toISOString().slice(0, 10);
		let n = 0;
		for (const id of ids) {
			const p = this.person(id);
			if (!p) continue;
			if (op.kind === 'category') {
				if (p.category_id === op.category_id) continue;
				this.d.changeLog.unshift({ id: uid(), person_id: id, at: now(), by: this.who, field: '교인구분(일괄)', before: this.catLabel(p.category_id), after: this.catLabel(op.category_id) });
				p.category_id = op.category_id;
			} else if (op.kind === 'faith') {
				// 같은 신급 기록이 이미 있으면 건너뜀
				if (this.d.faithEvents.some((e) => e.person_id === id && e.kind === op.faith)) continue;
				this.d.faithEvents.push({ id: uid(), person_id: id, kind: op.faith, event_date: op.date, church: null, officiant: null, note: null });
				this.change(id, '신급 이력(일괄)', `${op.faith} ${op.date ?? '(날짜 미상)'}`);
			} else if (op.kind === 'office') {
				const { rank_status, clergy } = parseRank(op.rank);
				const live = this.d.officeTerms.filter((t) => t.person_id === id && !t.end_date);
				if (live.some((t) => t.office === op.office && t.rank_status === rank_status)) continue;
				// 지금 직분은 새 직분 시작일(없으면 오늘)로 마침 처리
				if (op.endOld) for (const t of live) t.end_date = op.date ?? today;
				this.d.officeTerms.push({ id: uid(), person_id: id, office: op.office, rank_status, start_date: op.date, end_date: null, church: null, note: null });
				if (op.office === '목사' || op.office === '전도사') p.clergy_title = clergy;
				this.change(id, '직분 이력(일괄)', `${op.office} ${clergy ?? rank_status} ${op.date ?? '(날짜 미상)'}`);
			} else {
				const cur = this.groupOf(id);
				if ((cur?.community ?? '') === op.community && (cur?.small_group ?? '') === op.small_group) continue;
				const before = cur ? `${cur.community} › ${cur.small_group}` : null;
				if (!op.community || !op.small_group) this.d.personGroups = this.d.personGroups.filter((g) => g.person_id !== id);
				else if (cur) { cur.community = op.community; cur.small_group = op.small_group; }
				else this.d.personGroups.push({ person_id: id, community: op.community, small_group: op.small_group });
				this.d.changeLog.unshift({ id: uid(), person_id: id, at: now(), by: this.who, field: '소그룹(일괄)', before, after: op.community && op.small_group ? `${op.community} › ${op.small_group}` : null });
			}
			n++;
		}
		const what = op.kind === 'category' ? `교인구분 → ${this.catLabel(op.category_id)}` : op.kind === 'faith' ? `신급 → ${op.faith}` : op.kind === 'office' ? `직분 → ${op.office} ${op.rank}` : `소그룹 → ${op.small_group ? `${op.community} › ${op.small_group}` : '소속 없음'}`;
		this.log('일괄 수정', `${what} · ${n}명 (선택 ${ids.length}명)`);
		return n;
	}
	// ---- 문자 자주 쓰는 문구 ----
	get smsTemplates(): SmsTemplate[] { return this.d.smsTemplates ?? DEFAULT_SMS_TEMPLATES; }
	saveSmsTemplate(t: { id?: string; title: string; body: string }): string {
		const list = [...this.smsTemplates];
		const title = t.title.trim() || '이름 없는 문구';
		const i = t.id ? list.findIndex((x) => x.id === t.id) : -1;
		const id = i >= 0 ? list[i].id : uid();
		if (i >= 0) list[i] = { id, title, body: t.body };
		else list.push({ id, title, body: t.body });
		this.d.smsTemplates = list;
		this.save();
		return id;
	}
	deleteSmsTemplate(id: string) {
		this.d.smsTemplates = this.smsTemplates.filter((x) => x.id !== id);
		this.save();
	}
	addNote(person_id: string, body: string) {
		this.d.notes.unshift({ id: uid(), person_id, body, author: this.who, created_at: today() });
		this.change(person_id, '담당자 메모', body.slice(0, 30));
		this.save();
	}
	addConsent(c: Omit<T.Consent, 'id'>) {
		this.d.consents.push({ ...c, id: uid() });
		this.change(c.person_id, '동의 기록', c.kind);
		this.save();
	}
	revokeConsent(id: string) {
		const c = this.d.consents.find((x) => x.id === id);
		if (c) {
			c.revoked_on = today();
			this.change(c.person_id, '동의 철회', c.kind);
			this.save();
		}
	}
	// 심방 내용에서 뽑은 일정의 '누구'를 세대 안에서 찾기.
	// 이름(민준 → 김민준)이나 '자녀·아들·딸'(해당 자녀가 한 명일 때)로 찾으면 그 교인의 일정으로,
	// 못 찾으면 심방받은 본인의 일정으로 넣고 제목에 적힌 말을 붙임 (예: 홍길동 · 자녀 입대)
	resolveCare(personId: string, list: CareEvent[]): (CareEvent & { person_id: string; label: string })[] {
		const self = this.person(personId);
		const hh = this.householdOf(personId);
		const fam = hh ? this.membersOfHousehold(hh.id).filter((m) => m.person_id !== personId) : [];
		const famName = (m: T.HouseholdMember) => (m.person_id ? this.person(m.person_id)?.name ?? m.name : m.name);
		const pick = (who: string): T.HouseholdMember | undefined => {
			const byName = fam.filter((m) => { const n = famName(m); return n === who || (n.length >= 3 && n.slice(1) === who); });
			if (byName.length === 1) return byName[0];
			const kids = fam.filter((m) => m.relation === '자녀' || m.relation === '손자녀');
			const g = (m: T.HouseholdMember) => (m.person_id ? this.person(m.person_id)?.gender : null);
			const myRel = hh ? this.membersOfHousehold(hh.id).find((m) => m.person_id === personId)?.relation : undefined;
			if (/아내|남편|배우자/.test(who)) { const sp = fam.filter((m) => (myRel === '배우자' ? m.relation === '본인' : m.relation === '배우자')); return sp.length === 1 ? sp[0] : undefined; }
			const pool = /아들|손자/.test(who) ? kids.filter((m) => g(m) === 'M') : /딸|손녀/.test(who) ? kids.filter((m) => g(m) === 'F') : /자녀|막내|손주/.test(who) ? kids : [];
			return pool.length === 1 ? pool[0] : undefined;
		};
		return list.map((c) => {
			const m = c.who ? pick(c.who) : undefined;
			if (m?.person_id) return { ...c, person_id: m.person_id, label: `${famName(m)} ${c.title}` };
			const title = c.who ? `${m ? famName(m) : c.who} ${c.title}` : c.title;
			return { ...c, title, person_id: personId, label: `${self?.name ?? ''} ${title}` };
		});
	}
	// 심방 기록. 내용·후속 조치에 '22일 입원, 23일 수술'처럼 날짜가 적힌 일은 캘린더 '성도' 일정으로 자동 등록하고, 등록한 일정을 돌려줌
	addVisit(v: Omit<T.Visit, 'id'>) {
		this.d.visits.unshift({ ...v, id: uid() });
		const name = this.person(v.person_id)?.name ?? '';
		this.log('심방 기록', name);
		const found = this.resolveCare(v.person_id, extractCareEvents(`${v.content}\n${v.follow_up ?? ''}`, v.visit_date))
			.filter((c) => !this.d.events.some((e) => e.kind === '성도' && e.person_id === c.person_id && e.date === c.date && e.title === c.title));
		for (const c of found) this.d.events.push({ id: uid(), kind: '성도', date: c.date, end_date: c.end_date, title: c.title, person_id: c.person_id, note: `${name} 심방 기록에서 자동 등록 (${v.visit_date})` });
		if (found.length) this.log('일정 등록', `성도 일정 ${found.map((c) => `${c.date.slice(5)} ${c.label}`).join(', ')}`);
		return found;
	}
	// 캘린더 일정 (교회 절기 · 사역 일정 · 성례 일정)
	// [실제 시스템] events 표에 저장. 수정 권한이 있는 회원만 등록·수정·삭제
	addEvent(e: Omit<T.ChurchEvent, 'id'>) {
		this.d.events.push({ ...e, id: uid() });
		this.log('일정 등록', `${e.date} ${e.title}`);
	}
	// 연간 계획 엑셀에서 여러 건을 한꺼번에 등록
	addEvents(list: Omit<T.ChurchEvent, 'id'>[]) {
		for (const e of list) this.d.events.push({ ...e, id: uid() });
		this.log('일정 등록', `연간 계획 엑셀 ${list.length}건`);
	}
	updateEvent(id: string, patch: Partial<Omit<T.ChurchEvent, 'id'>>) {
		const e = this.d.events.find((x) => x.id === id);
		if (!e) return;
		Object.assign(e, patch);
		this.log('일정 수정', `${e.date} ${e.title}`);
	}
	removeEvent(id: string) {
		const e = this.d.events.find((x) => x.id === id);
		if (!e) return;
		this.d.events = this.d.events.filter((x) => x.id !== id);
		this.log('일정 삭제', `${e.date} ${e.title}`);
	}
	addAffiliation(a: Omit<T.Affiliation, 'id'>) {
		this.d.affiliations.push({ ...a, id: uid() });
		this.save();
	}
	endAffiliation(id: string) {
		const a = this.d.affiliations.find((x) => x.id === id);
		if (a) { a.end_date = today(); this.save(); }
	}
	addEducation(r: Omit<T.EducationRecord, 'id'>) {
		this.d.educationRecords.push({ ...r, id: uid() });
		this.change(r.person_id, '교육', `${this.d.educationCourses.find((c) => c.id === r.course_id)?.name ?? ''} ${r.completed ? '수료' : '시작'}`);
		this.save();
	}
	completeEducation(id: string, date: string) {
		const r = this.d.educationRecords.find((x) => x.id === id);
		if (r) {
			r.completed = true; r.end_date = date; r.note = null;
			this.change(r.person_id, '교육', '새가족 교육 수료');
			this.save();
		}
	}
	addGroupNote(n: Omit<T.GroupNote, 'id'>) {
		this.d.groupNotes.unshift({ ...n, id: uid() });
		this.save();
	}

	// ---- 관리자 설정 ----
	renameCategory(id: string, name: string) {
		const c = this.d.categories.find((x) => x.id === id);
		if (c && name.trim()) { c.name = name.trim(); this.save(); }
	}
	addCategory(parent_id: string | null, name: string) {
		const depth = categoryPath(this.d.categories, parent_id).length;
		if (depth >= MAX_CATEGORY_DEPTH || !name.trim()) return false;
		const order = this.childrenOf(parent_id).length + 1;
		this.d.categories.push({ id: uid(), parent_id, name: name.trim(), sort_order: order });
		this.save();
		return true;
	}
	// 같은 단계 안에서 순서 바꾸기: id 를 형제 목록의 index 자리로 옮기고 순번을 1부터 다시 매김
	moveCategory(id: string, index: number) {
		const c = this.d.categories.find((x) => x.id === id);
		if (!c) return;
		const sibs = this.childrenOf(c.parent_id).filter((x) => x.id !== id);
		sibs.splice(Math.max(0, Math.min(index, sibs.length)), 0, c);
		sibs.forEach((x, i) => (x.sort_order = i + 1));
		this.save();
	}
	categoryUsage(id: string) {
		const ids = new Set<string>([id]);
		let grew = true;
		while (grew) { grew = false; for (const c of this.d.categories) if (c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) { ids.add(c.id); grew = true; } }
		return { ids, count: this.d.people.filter((p) => p.category_id && ids.has(p.category_id)).length };
	}
	deleteCategory(id: string) {
		const u = this.categoryUsage(id);
		if (u.count) return false;
		this.d.categories = this.d.categories.filter((c) => !u.ids.has(c.id));
		this.save();
		return true;
	}
	updateGroup(id: string, patch: Partial<T.SmallGroup>) {
		const g = this.d.smallGroups.find((x) => x.id === id);
		if (g) { Object.assign(g, patch); this.save(); }
	}
	// 공동체의 소그룹 (설정에서 바꾼 순서·이름 그대로)
	groupsIn(community: string) {
		return this.d.smallGroups.filter((g) => g.community === community).sort((a, b) => a.sort_order - b.sort_order);
	}
	groupMemberCount(name: string) { return this.d.personGroups.filter((g) => g.small_group === name).length; }
	// 소그룹 추가: 같은 이름이 있으면 false
	addSmallGroup(community: string, name: string, place: string | null, leader_id: string | null): string | null {
		name = name.trim();
		if (!community || !name) return '공동체와 소그룹 이름을 넣어 주세요.';
		if (this.d.smallGroups.some((g) => g.name === name)) return `'${name}' 소그룹이 이미 있습니다.`;
		const order = Math.max(0, ...this.groupsIn(community).filter((g) => !g.care).map((g) => g.sort_order)) + 1;
		// 자녀돌봄 편성은 늘 맨 아래에 두도록 뒤로 밀어 줌
		for (const g of this.groupsIn(community)) if (g.care && g.sort_order >= order) g.sort_order++;
		this.d.smallGroups.push({ id: uid(), community, name, place: place?.trim() || null, leader_id, care: false, sort_order: order });
		this.log('소그룹 추가', `${community} › ${name}`);
		return null;
	}
	// 소그룹 수정: 이름·공동체가 바뀌면 소속 교인·인도자 특이사항도 같이 바꿈
	editSmallGroup(id: string, patch: { name: string; community: string; place: string | null; leader_id: string | null }): string | null {
		const g = this.d.smallGroups.find((x) => x.id === id);
		if (!g) return '소그룹을 찾을 수 없습니다.';
		const name = patch.name.trim();
		if (!name) return '소그룹 이름을 넣어 주세요.';
		if (name !== g.name && this.d.smallGroups.some((x) => x.name === name)) return `'${name}' 소그룹이 이미 있습니다.`;
		const old = g.name;
		if (patch.community !== g.community) g.sort_order = Math.max(0, ...this.groupsIn(patch.community).map((x) => x.sort_order)) + 1;
		for (const pg of this.d.personGroups) if (pg.small_group === old) { pg.small_group = name; pg.community = patch.community; }
		for (const n of this.d.groupNotes) if (n.small_group === old) n.small_group = name;
		Object.assign(g, { name, community: patch.community, place: patch.place?.trim() || null, leader_id: patch.leader_id });
		this.log('소그룹 수정', old === name ? name : `${old} → ${name}`);
		return null;
	}
	// 소그룹 삭제: 소속 교인이 있으면 지우지 않음
	deleteSmallGroup(id: string): string | null {
		const g = this.d.smallGroups.find((x) => x.id === id);
		if (!g) return null;
		const n = this.groupMemberCount(g.name);
		if (n) return `'${g.name}'에 소속 교인 ${n}명이 있어 지울 수 없습니다. 먼저 교인들을 다른 소그룹으로 옮겨 주세요.`;
		this.d.smallGroups = this.d.smallGroups.filter((x) => x.id !== id);
		this.log('소그룹 삭제', `${g.community} › ${g.name}`);
		return null;
	}
	addOrgUnit(parent_id: string | null, name: string) {
		if (!name.trim()) return;
		this.d.orgUnits.push({ id: uid(), parent_id, name: name.trim(), sort_order: this.d.orgUnits.filter((o) => o.parent_id === parent_id).length + 1, leader_id: null, staff_ids: [] });
		this.save();
	}
	renameOrgUnit(id: string, name: string) {
		const o = this.d.orgUnits.find((x) => x.id === id);
		if (o && name.trim()) {
			// 소속 기록의 이름도 함께 바꿈
			for (const a of this.d.affiliations) if (a.org === o.name) a.org = name.trim();
			o.name = name.trim();
			this.save();
		}
	}
	setOrgLeader(id: string, leader_id: string | null) {
		const o = this.d.orgUnits.find((x) => x.id === id);
		if (o) { o.leader_id = leader_id; this.save(); }
	}
	setOrgStaff(id: string, staff_ids: string[]) {
		const o = this.d.orgUnits.find((x) => x.id === id);
		if (o) { o.staff_ids = staff_ids; this.save(); }
	}
	setOrgClergy(id: string, clergy_id: string | null) {
		const o = this.d.orgUnits.find((x) => x.id === id);
		if (o) { o.clergy_id = clergy_id || null; this.save(); }
	}
	moveOrgUnit(id: string, dir: -1 | 1) {
		const o = this.d.orgUnits.find((x) => x.id === id);
		if (!o) return;
		const sibs = this.d.orgUnits.filter((x) => x.parent_id === o.parent_id).sort((a, b) => a.sort_order - b.sort_order);
		const i = sibs.indexOf(o), j = i + dir;
		if (j < 0 || j >= sibs.length) return;
		[sibs[i].sort_order, sibs[j].sort_order] = [sibs[j].sort_order, sibs[i].sort_order];
		this.save();
	}
	setMeeting(meeting: string, field: 'chair' | 'secretary', value: string) {
		const m = this.d.meetings.find((x) => x.meeting === meeting);
		if (m) { m[field] = value.trim(); this.save(); }
	}
	deleteOrgUnit(id: string) {
		const ids = new Set([id, ...this.d.orgUnits.filter((o) => o.parent_id === id).map((o) => o.id)]);
		const names = this.d.orgUnits.filter((o) => ids.has(o.id)).map((o) => o.name);
		if (this.d.affiliations.some((a) => names.includes(a.org) && !a.end_date)) return false;
		this.d.orgUnits = this.d.orgUnits.filter((o) => !ids.has(o.id));
		this.save();
		return true;
	}

	// 공동체·소그룹 소속 (출석부 자료. 이동 이력은 따로 남기지 않음)
	setGroup(person_id: string, community: string, small_group: string) {
		const cur = this.groupOf(person_id);
		const label = (c?: { community: string; small_group: string }) => (c ? `${c.community} › ${c.small_group}` : null);
		const before = label(cur);
		if (!community || !small_group) {
			if (cur) this.d.personGroups = this.d.personGroups.filter((g) => g.person_id !== person_id);
		} else if (cur) { cur.community = community; cur.small_group = small_group; }
		else this.d.personGroups.push({ person_id, community, small_group });
		this.d.changeLog.unshift({ id: uid(), person_id, at: now(), by: this.who, field: '소그룹', before, after: community && small_group ? `${community} › ${small_group}` : null });
		this.save();
	}

	// 새가족 등록: 교적 카드 + 재적(등록) + 동의 기록
	createPerson(p: Omit<T.Person, 'id'>, regDate: string | null, consents: T.ConsentKind[], method: T.ConsentMethod) {
		const id = uid();
		this.d.people.push({ ...p, id });
		this.d.statusEvents.push({ id: uid(), person_id: id, kind: '등록', event_date: regDate, reason: '새가족', church: null });
		for (const kind of consents)
			this.d.consents.push({ id: uid(), person_id: id, kind, policy_version: '2026-01', consent_date: today(), method, guardian_name: null, revoked_on: null });
		this.change(id, '교적 카드', '교인 등록');
		this.assignNameNotes(p.name);
		this.log('수정', p.name);
		return id;
	}

	// ---- 세대 ----
	createHousehold(address: string | null) {
		const nextNo = `H-${String(this.d.households.length + 1).padStart(3, '0')}`;
		const h: T.Household = { id: uid(), no: nextNo, zip: null, address, home_phone: null, note: null };
		this.d.households.push(h);
		this.save();
		return h;
	}
	// 한 사람은 한 세대에만 속함: 이미 있으면 옮김
	assignToHousehold(person_id: string, household_id: string, relation: string) {
		this.d.householdMembers = this.d.householdMembers.filter((m) => m.person_id !== person_id);
		const order = this.membersOfHousehold(household_id).length + 1;
		this.d.householdMembers.push({ id: uid(), household_id, person_id, name: '', birth_year: null, relation, sort_order: order, note: null });
		this.change(person_id, '세대', `${this.d.households.find((h) => h.id === household_id)?.no} (${relation})`);
		this.save();
	}
	addNonMember(household_id: string, name: string, birth_year: number | null, relation: string) {
		const order = this.membersOfHousehold(household_id).length + 1;
		this.d.householdMembers.push({ id: uid(), household_id, person_id: null, name, birth_year, relation, sort_order: order, note: '교인 아님' });
		this.save();
	}
	setRelation(member_id: string, relation: string) {
		const m = this.d.householdMembers.find((x) => x.id === member_id);
		if (m) { m.relation = relation; this.save(); }
	}
	removeFromHousehold(member_id: string) {
		this.d.householdMembers = this.d.householdMembers.filter((x) => x.id !== member_id);
		this.save();
	}
	// 분가: 새 세대를 만들고 세대원을 옮김
	split(member_ids: string[]) {
		const first = this.d.householdMembers.find((m) => m.id === member_ids[0]);
		const src = this.d.households.find((h) => h.id === first?.household_id);
		const h = this.createHousehold(src?.address ?? null);
		member_ids.forEach((mid, i) => {
			const m = this.d.householdMembers.find((x) => x.id === mid);
			if (m) { m.household_id = h.id; m.sort_order = i + 1; m.relation = i === 0 ? '본인' : m.relation; }
		});
		this.save();
		return h;
	}

	// 중복 확인: 이름 또는 전화가 같은 사람
	findDuplicates(name: string, phone: string) {
		const digits = phone.replace(/\D/g, '');
		return this.d.people.filter((p) => (name && p.name === name) || (digits.length >= 7 && (p.phone ?? '').replace(/\D/g, '') === digits));
	}
}

export const registry = new Registry();
