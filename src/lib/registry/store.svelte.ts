// 프로토타입 저장소: 브라우저 localStorage. 실제 개발 시 Supabase 호출로 교체.
import * as seed from './seed.ts';
import type * as T from './types.ts';
import { currentFaith, currentOffice, currentStatus, officeTitle, registeredOn } from './derive.ts';

const KEY = 'church-registry-proto-v1';
const PERM_KEY = 'church-registry-perms-v1';
const WHO = '데모 사용자';
const hasLS = typeof localStorage !== 'undefined';

interface Data {
	people: T.Person[];
	households: T.Household[];
	householdMembers: T.HouseholdMember[];
	statusEvents: T.StatusEvent[];
	faithEvents: T.FaithEvent[];
	officeTerms: T.OfficeTerm[];
	personGroups: T.PersonGroup[];
	notes: T.Note[];
	legacyMemos: T.LegacyMemo[];
	consents: T.Consent[];
	changeLog: T.ChangeLogEntry[];
	accessLog: T.AccessLogEntry[];
	visits: T.Visit[];
	affiliations: T.Affiliation[];
	groupHistory: T.GroupHistory[];
}

const initial = (): Data => structuredClone({ ...seed } as unknown as Data);
const now = () => new Date().toISOString().slice(0, 16).replace('T', ' ');
const today = () => new Date().toISOString().slice(0, 10);
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
function loadPerms(): T.Perms {
	if (hasLS) {
		try {
			const raw = localStorage.getItem(PERM_KEY);
			if (raw) return JSON.parse(raw);
		} catch {}
	}
	return { edit: true, export: true, visit: true, admin: true };
}

const fmt = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));

class Registry {
	d = $state<Data>(load());
	perms = $state<T.Perms>(loadPerms());

	private save() {
		if (hasLS) try { localStorage.setItem(KEY, JSON.stringify(this.d)); } catch {}
	}
	setPerms(p: T.Perms) {
		this.perms = p;
		if (hasLS) try { localStorage.setItem(PERM_KEY, JSON.stringify(p)); } catch {}
	}
	reset() {
		this.d = initial();
		this.save();
	}

	// ---- 조회 ----
	person(id: string) { return this.d.people.find((p) => p.id === id); }
	statusOf(id: string) { return this.d.statusEvents.filter((e) => e.person_id === id); }
	faithOf(id: string) { return this.d.faithEvents.filter((e) => e.person_id === id); }
	officesOf(id: string) { return this.d.officeTerms.filter((e) => e.person_id === id); }
	groupOf(id: string) { return this.d.personGroups.find((g) => g.person_id === id); }
	memberOf(personId: string) { return this.d.householdMembers.find((m) => m.person_id === personId); }
	householdOf(personId: string) {
		const m = this.memberOf(personId);
		return m ? this.d.households.find((h) => h.id === m.household_id) : undefined;
	}
	membersOfHousehold(hid: string) {
		return this.d.householdMembers.filter((m) => m.household_id === hid).sort((a, b) => a.sort_order - b.sort_order);
	}

	// 카드에 보이는 '지금 값' (이력에서 계산)
	summary(p: T.Person) {
		const st = currentStatus(this.statusOf(p.id));
		const office = currentOffice(this.officesOf(p.id));
		const g = this.groupOf(p.id);
		return {
			status: st.label,
			statusKind: st.status,
			memberCert: st.memberCert,
			faith: currentFaith(this.faithOf(p.id), p),
			office,
			title: office ? officeTitle(office) : '',
			registered: registeredOn(this.statusOf(p.id)),
			community: g?.community ?? '',
			smallGroup: g?.small_group ?? ''
		};
	}

	// ---- 기록 ----
	log(action: string, target: string) {
		this.d.accessLog.unshift({ id: uid(), at: now(), who: WHO, action, target });
		if (this.d.accessLog.length > 500) this.d.accessLog.length = 500;
		this.save();
	}

	updatePerson(id: string, patch: Partial<T.Person>) {
		const p = this.person(id);
		if (!p) return;
		for (const [k, v] of Object.entries(patch)) {
			const before = (p as any)[k];
			if (fmt(before) === fmt(v)) continue;
			this.d.changeLog.unshift({ id: uid(), person_id: id, at: now(), by: WHO, field: k, before: fmt(before), after: fmt(v) });
			(p as any)[k] = v;
		}
		this.log('수정', p.name);
	}

	private change(person_id: string, field: string, after: string) {
		this.d.changeLog.unshift({ id: uid(), person_id, at: now(), by: WHO, field, before: null, after });
	}
	addStatus(e: Omit<T.StatusEvent, 'id'>) {
		this.d.statusEvents.push({ ...e, id: uid() });
		this.change(e.person_id, '재적 이력', `${e.kind} ${e.event_date ?? '(날짜 미상)'}`);
		this.log('수정', this.person(e.person_id)?.name ?? '');
	}
	addFaith(e: Omit<T.FaithEvent, 'id'>) {
		this.d.faithEvents.push({ ...e, id: uid() });
		this.change(e.person_id, '신급 이력', `${e.kind} ${e.event_date ?? '(날짜 미상)'}`);
		this.log('수정', this.person(e.person_id)?.name ?? '');
	}
	addOffice(e: Omit<T.OfficeTerm, 'id'>) {
		this.d.officeTerms.push({ ...e, id: uid() });
		this.change(e.person_id, '직분 이력', `${e.office} ${e.rank_status} ${e.start_date ?? '(날짜 미상)'}`);
		this.log('수정', this.person(e.person_id)?.name ?? '');
	}
	addNote(person_id: string, body: string) {
		this.d.notes.unshift({ id: uid(), person_id, body, author: WHO, created_at: today() });
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
	addAffiliation(a: Omit<T.Affiliation, 'id'>) {
		this.d.affiliations.push({ ...a, id: uid() });
		this.save();
	}

	setGroup(person_id: string, community: string, small_group: string) {
		const cur = this.groupOf(person_id);
		if (cur?.small_group && cur.small_group !== small_group) {
			// 새 자료 시험: 이동 이력
			this.d.groupHistory.push({ id: uid(), person_id, small_group: cur.small_group, start_date: null, end_date: today() });
		}
		if (cur) { cur.community = community; cur.small_group = small_group; }
		else this.d.personGroups.push({ person_id, community, small_group });
		this.save();
	}

	// 새가족 등록: 교적 카드 + 재적(등록) + 동의 기록
	createPerson(p: Omit<T.Person, 'id'>, regDate: string | null, consents: T.ConsentKind[], method: T.ConsentMethod) {
		const id = uid();
		this.d.people.push({ ...p, id });
		this.d.statusEvents.push({ id: uid(), person_id: id, kind: '등록', event_date: regDate, reason: '새가족', church: null });
		for (const kind of consents)
			this.d.consents.push({ id: uid(), person_id: id, kind, policy_version: '2026-01', consent_date: today(), method, guardian_name: null, revoked_on: null });
		this.change(id, '교적 카드', '새가족 등록');
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
