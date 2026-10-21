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
import { wasPresent } from './attendance.mock.ts';
import { isoDate, type CalItem } from './calendar.ts';
import { MAX_CATEGORY_DEPTH } from './types.ts';

const KEY = 'church-registry-proto-v16';
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
	attendance: Record<string, Record<string, T.AttendanceMark>>;
	users: T.AppUser[];
	grades: T.GradeDef[];
}

const initial = (): Data => {
	const { generated, ...rest } = seed as unknown as Record<string, unknown>;
	void generated;
	return structuredClone(rest) as unknown as Data;
};
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const today = () => isoDate(new Date());
const uid = () => crypto.randomUUID();

function load(): Data {
	if (hasLS) {
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) return JSON.parse(raw);
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
		if (u.is_super) return { edit: true, export: true, visit: true, admin: true };
		return this.gradeDef(u.grade)?.perms ?? NO_PERMS;
	}
	get perms(): T.Perms { return this.permsOf(this.me); }
	get isSuper(): boolean { return !!this.me?.is_super && this.me.status === '사용'; }
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
		if (status === '사용' && !u.grade) u.grade = 1;
		this.log(`회원 ${status === '사용' ? '사용 재개' : status}`, u.name);
	}
	setGradePerm(grade: T.Grade, key: keyof T.Perms, value: boolean) {
		const g = this.gradeDef(grade);
		if (!g || !this.isSuper) return;
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
	// 이번에 직접 입력한 값이 있으면 그것을, 없으면 (가상) 출석부 샘플을 따름
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

	// ---- 검색 (대시보드 검색창: 무엇이든) ----
	search(q: string) {
		const terms = q.toLowerCase().split(/\s+/).filter(Boolean);
		const digits = (s: string) => s.replace(/\D/g, '');
		const empty = { people: [] as T.Person[], groups: [] as T.SmallGroup[], households: [] as T.Household[], visits: [] as T.Visit[], notes: [] as { p: T.Person; body: string; kind: string }[], orgs: [] as T.OrgUnit[], total: 0 };
		if (!terms.length) return empty;
		const hit = (hay: string) => terms.every((t) => hay.includes(t) || (digits(t).length >= 3 && digits(hay).includes(digits(t))));
		const people: T.Person[] = [];
		let total = 0;
		for (const p of this.d.people) {
			const s = this.summary(p);
			const hh = this.householdOf(p.id);
			const hay = [p.name, p.name_note, p.phone, p.address1, p.address2, hh?.address, p.occupation, p.workplace, p.note, p.previous_church, p.reg_no, p.email, s.title, s.status, s.faith,
				s.community, s.smallGroup, s.category, p.mission_society, p.edu_dept, p.clergy_title, p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : ''].filter(Boolean).join(' ').toLowerCase();
			if (hit(hay)) { total++; if (people.length < 8) people.push(p); }
		}
		const groups = this.d.smallGroups.filter((g) => hit(`${g.community} ${g.name} ${g.place ?? ''} ${this.person(g.leader_id ?? '')?.name ?? ''}`.toLowerCase())).slice(0, 6);
		const households = this.d.households.filter((h) => hit(`${h.no} ${h.address ?? ''} ${h.home_phone ?? ''}`.toLowerCase())).slice(0, 5);
		const visits = this.perms.visit ? this.d.visits.filter((v) => hit(`${v.content} ${v.kind} ${v.pastor} ${v.scripture ?? ''} ${v.follow_up ?? ''} ${this.person(v.person_id)?.name ?? ''}`.toLowerCase())).slice(0, 5) : [];
		const notes: { p: T.Person; body: string; kind: string }[] = [];
		for (const n of this.d.notes) if (hit(n.body.toLowerCase())) { const p = this.person(n.person_id); if (p) notes.push({ p, body: n.body, kind: '담당자 메모' }); if (notes.length >= 4) break; }
		// 인도자 특이사항은 건강 등 민감한 내용이 있어 심방 권한자만
		if (this.perms.visit) for (const n of this.d.groupNotes) if (notes.length < 6 && hit(`${n.body} ${n.small_group}`.toLowerCase())) { const p = this.person(n.person_id); if (p) notes.push({ p, body: n.body, kind: `인도자 특이사항 · ${n.small_group}` }); }
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
		// [샘플 전용] 가상 데이터가 많아 달력이 빽빽하므로, 생일·결혼기념일·심방·가상 일정은 3분의 1만 보여 줍니다.
		//   실제 시스템에서는 이 거르기(sample)를 빼세요. 직접 등록한 일정은 거르지 않습니다.
		const sample = (key: string) => {
			let h = 0;
			for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) | 0;
			return Math.abs(h) % 3 === 0;
		};
		if (kinds.has('생일') || kinds.has('성도 기념일')) {
			const seenWedding = new Set<string>();
			for (const p of this.d.people) {
				if (!sample(p.id)) continue;
				if (!this.statusOf(p.id).length) continue;
				const s = this.summary(p);
				if (!s.memberCert) continue;
				if (kinds.has('생일') && p.birth_date && p.birth_date.slice(5, 7) === mm) {
					const d = Math.min(+p.birth_date.slice(8, 10), last);
					out.push({ date: `${year}-${mm}-${String(d).padStart(2, '0')}`, kind: '생일', title: `${p.name}${s.title ? ' ' + s.title : ''}`, sub: p.birth_lunar ? '음력 생일' : '양력 생일', person_id: p.id, href: `/${p.id}` });
				}
				if (kinds.has('성도 기념일') && p.wedding_date && p.wedding_date.slice(5, 7) === mm) {
					const hh = this.householdOf(p.id);
					const key = `${hh?.id ?? p.id}|${p.wedding_date}`;
					if (seenWedding.has(key)) continue;
					seenWedding.add(key);
					const d = Math.min(+p.wedding_date.slice(8, 10), last);
					out.push({ date: `${year}-${mm}-${String(d).padStart(2, '0')}`, kind: '성도 기념일', title: `${p.name} 결혼 ${year - +p.wedding_date.slice(0, 4)}주년`, sub: '결혼기념일', person_id: p.id, href: `/${p.id}` });
				}
			}
		}
		const monthStart = `${year}-${mm}-01`, monthEnd = `${year}-${mm}-${String(last).padStart(2, '0')}`;
		for (const e of this.d.events) {
			if (!kinds.has(e.kind)) continue;
			const end = e.end_date ?? e.date;
			if (end < monthStart || e.date > monthEnd) continue;
			// 가상으로 만든 반복 일정(대청소·기도회·당회 등)과 성도 기념일만 거름. 교회 절기·성례는 그대로
			if (/^ev\d+$/.test(e.id) && (e.kind === '사역 일정' || e.kind === '성도 기념일') && !sample(e.id)) continue;
			const who = nameOf(e.person_id);
			out.push({ date: e.date, end_date: e.end_date, kind: e.kind, title: who ? `${who} ${e.title}` : e.title, sub: e.note ?? undefined, event_id: e.id, person_id: e.person_id, href: e.person_id ? `/${e.person_id}` : undefined });
		}
		if (kinds.has('심방 계획') && this.perms.visit) {
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
		else if (kind === '보류' && cur.startsWith('m.')) next = cur.replace(/\.[asnl]$/, '.n');
		else if (kind === '등록' || kind === '전입' || kind === '복적') {
			if (cur.startsWith('o.')) next = 'm' + cur.slice(1);
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
	addVisit(v: Omit<T.Visit, 'id'>) {
		this.d.visits.unshift({ ...v, id: uid() });
		this.log('심방 기록', this.person(v.person_id)?.name ?? '');
	}
	// 캘린더 일정 (교회 기념일 · 사역 일정 · 성례 일정)
	// [실제 시스템] events 표에 저장. 수정 권한이 있는 회원만 등록·수정·삭제
	addEvent(e: Omit<T.ChurchEvent, 'id'>) {
		this.d.events.push({ ...e, id: uid() });
		this.log('일정 등록', `${e.date} ${e.title}`);
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
