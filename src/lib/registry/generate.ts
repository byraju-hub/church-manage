// 실제 교회 규모(재적 약 1,100명)의 가상 교적 데이터를 만듭니다.
// - 이름·전화·주소는 모두 만들어 낸 값이며 실제 교인 자료를 쓰지 않습니다.
// - 같은 시드로 만들기 때문에 열 때마다 같은 사람들이 나옵니다. (날짜는 오늘 기준으로 맞춤)
// - 공동체·소그룹 구성(3개 공동체, 소그룹 27개 + 로뎀나무숲)만 2026년 편성표의 구조를 따릅니다.
import type * as T from './types.ts';

export interface GroupDef { name: string; size: number; place: string; care?: boolean }
export interface CommunityDef { name: string; born: string; from: number; to: number; groups: GroupDef[] }

const G = (name: string, size: number, place: string, care = false): GroupDef => ({ name, size, place, care });

// 출석부의 조직 구성 (공동체는 출생 연도로 나뉨)
export const COMMUNITY_DEFS: CommunityDef[] = [
	{
		name: '뿌리 공동체', born: '55년 이전 출생', from: 1900, to: 1955,
		groups: [
			G('나눔의향기', 20, '다니엘관 101호'), G('브니엘', 18, '다니엘관 201호'), G('만나', 23, '다니엘관 306호'), G('루디아', 24, '휴게실'),
			G('해피', 18, '새가족부실'), G('화평', 20, '챔버실'), G('온유', 25, '카페'), G('사랑', 31, '찬양대실')
		]
	},
	{
		name: '줄기 공동체', born: '56~70년 출생', from: 1956, to: 1970,
		groups: [
			G('헵시바', 15, '다니엘관 204호'), G('엎드림', 13, '본관 301호'), G('바라크', 11, '다니엘관 302호'), G('임마누엘', 12, '다니엘관 205호'),
			G('우리가', 14, '다니엘관 206호'), G('미션', 19, '다니엘관 303호'), G('햇살통로', 21, '본관 2층 자모실'), G('시나브로', 19, '다니엘관 304호'),
			G('라온', 16, '다니엘관 207호'), G('톱니바퀴', 18, '다니엘관 307호'), G('은혜', 17, '유초등부실')
		]
	},
	{
		name: '열매 공동체', born: '71년 이후 출생', from: 1971, to: 2100,
		groups: [
			G('훈남', 26, '다니엘관 203호'), G('광야', 25, '본관 B01'), G('누림', 14, '다니엘관 301호'), G('위러브', 15, '다니엘관 208호'),
			G('기경', 16, '본관 302호'), G('푸풀', 16, '다니엘관 305호'), G('샬롬', 15, '다니엘관 202호'), G('디비디비딥', 16, '본당'),
			G('로뎀나무숲', 24, '자녀 돌봄', true)
		]
	}
];

// ---------- 난수와 날짜 ----------
function mulberry32(a: number) {
	return () => {
		a |= 0; a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function generate(reservedNames: string[] = []) {
	const rnd = mulberry32(20261020);
	const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
	const chance = (p: number) => rnd() < p;
	const pick = <X>(xs: readonly X[]): X => xs[Math.floor(rnd() * xs.length)];

	const NOW = new Date();
	const TODAY = isoOf(NOW);
	const THIS_YEAR = NOW.getFullYear();
	const daysAgo = (n: number) => { const d = new Date(NOW); d.setDate(d.getDate() - n); return isoOf(d); };
	const dateIn = (y: number) => `${y}-${pad(ri(1, 12))}-${pad(ri(1, 28))}`;
	const clampPast = (iso: string) => (iso > daysAgo(3) ? daysAgo(ri(3, 40)) : iso);
	const dateBetween = (a: string, b: string) => {
		const t0 = new Date(a).getTime(), t1 = new Date(b).getTime();
		return isoOf(new Date(t0 + rnd() * Math.max(0, t1 - t0)));
	};

	// ---------- 이름 ----------
	const SUR = '김김김김김이이이이이박박박박최최최정정정강조윤장임한오서신권황안송류전고문양손배백허유남심노하곽성차주우구나민'.split('');
	const M_NEW = [['민', '서', '준', '지', '현', '도', '성', '재', '우', '태', '승', '동'], ['호', '우', '훈', '석', '민', '준', '수', '혁', '진', '환', '규', '범']];
	const M_OLD = [['영', '종', '병', '창', '상', '광', '용', '석', '기', '명'], ['수', '호', '식', '철', '환', '규', '근', '복', '길', '만']];
	const F_NEW = [['서', '지', '수', '예', '은', '하', '유', '민', '다', '소'], ['연', '윤', '은', '진', '영', '현', '서', '빈', '아', '희', '린']];
	const F_OLD = [['영', '순', '정', '금', '옥', '미', '경', '춘', '복', '숙'], ['자', '순', '희', '숙', '애', '심', '임', '분', '란']];
	const reserved = new Set(reservedNames);
	const makeName = (surname: string, gender: 'M' | 'F', birth: number) => {
		const t = gender === 'M' ? (birth < 1966 ? M_OLD : M_NEW) : birth < 1966 ? F_OLD : F_NEW;
		for (let i = 0; i < 20; i++) {
			const n = surname + pick(t[0]) + pick(t[1]);
			if (!reserved.has(n)) return n;
		}
		return surname + pick(t[0]) + pick(t[1]);
	};

	// ---------- 결과 ----------
	const people: T.Person[] = [];
	const households: T.Household[] = [];
	const householdMembers: T.HouseholdMember[] = [];
	const statusEvents: T.StatusEvent[] = [];
	const faithEvents: T.FaithEvent[] = [];
	const officeTerms: T.OfficeTerm[] = [];
	const personGroups: T.PersonGroup[] = [];
	const notes: T.Note[] = [];
	const legacyMemos: T.LegacyMemo[] = [];
	const consents: T.Consent[] = [];
	const visits: T.Visit[] = [];
	const affiliations: T.Affiliation[] = [];
	const absentStreak: Record<string, number> = {};
	const attendRate: Record<string, number> = {};

	let nP = 0, nH = 4, nE = 0, nPhone = 1000, nReg = 100;
	const eid = (p: string) => `${p}g${++nE}`;
	const ageAt = (birth: number) => THIS_YEAR - birth;
	const commOf = (birth: number) => COMMUNITY_DEFS.findIndex((c) => birth >= c.from && birth <= c.to);

	// 소그룹 고르기: 정원 비율대로
	function pickGroup(ci: number, care = false) {
		const gs = COMMUNITY_DEFS[ci].groups.filter((g) => !!g.care === care);
		const total = gs.reduce((s, g) => s + g.size, 0);
		let r = rnd() * total;
		for (const g of gs) { r -= g.size; if (r <= 0) return g; }
		return gs[gs.length - 1];
	}

	interface Mk { surname: string; gender: 'M' | 'F'; birth: number; reg?: string | null; fresh?: boolean; previous?: boolean; marital?: T.MaritalStatus | null; wedding?: string | null; hasReg?: boolean; sleeping?: boolean }
	const JOBS = ['회사원', '자영업', '교사', '공무원', '간호사', '엔지니어', '주부', '프리랜서', '연구원', '의료인', '디자이너', '회계사'];

	function mkPerson(o: Mk): T.Person {
		const id = `g${++nP}`;
		const age = ageAt(o.birth);
		const hasPhone = age >= 14 && !chance(0.04);
		const p: T.Person = {
			id, name: makeName(o.surname, o.gender, o.birth), name_note: null,
			phone: hasPhone ? `010-0000-${++nPhone}` : null, gender: o.gender,
			birth_date: `${o.birth}-${pad(ri(1, 12))}-${pad(ri(1, 28))}`, email: null, has_account: hasPhone && age < 72 && chance(0.55),
			birth_lunar: age >= 55 && chance(0.15), reg_no: o.hasReg === false ? null : String(++nReg).padStart(4, '0'),
			address_zip: null, address1: null, address2: null,
			occupation: age >= 24 && age < 66 ? pick(JOBS) : age >= 8 && age < 24 ? '학생' : null,
			workplace: null, marital_status: o.marital ?? (age < 24 ? '미혼' : null), wedding_date: o.wedding ?? null,
			previous_church: o.previous ? `가상교회${ri(1, 9)}` : null, guide_person_id: null, guide_name: null,
			sms_opt_out: age >= 14 && chance(0.02), faith_checked_on: null, note: null, purged_on: null
		};
		people.push(p);
		return p;
	}

	function addStatus(pid: string, kind: T.StatusKind, date: string | null, reason: string | null = null, church: string | null = null) {
		statusEvents.push({ id: eid('s'), person_id: pid, kind, event_date: date, reason, church });
	}
	function addFaithEv(pid: string, kind: T.FaithKind, date: string | null, church: string | null = null) {
		faithEvents.push({ id: eid('f'), person_id: pid, kind, event_date: date, church, officiant: church ? null : '가상목사', note: null });
	}
	function addOffice(pid: string, office: T.OfficeName, st: T.OfficeStatus, start: string | null, end: string | null = null) {
		officeTerms.push({ id: eid('o'), person_id: pid, office, rank_status: st, start_date: start, end_date: end, note: null });
	}

	// 신급 이력: 나이대에 맞춰 세례·학습 등을 부여
	function giveFaith(p: T.Person, birth: number, reg: string, fresh: boolean) {
		const age = ageAt(birth);
		if (age <= 12) {
			if (chance(0.7)) addFaithEv(p.id, '유아세례', clampPast(dateIn(birth + ri(0, Math.min(2, Math.max(0, age))))));
			return;
		}
		if (age <= 19) {
			if (chance(0.3)) addFaithEv(p.id, '학습', clampPast(dateIn(birth + ri(12, Math.min(15, age)))));
			if (age >= 15 && chance(0.4)) addFaithEv(p.id, '입교', clampPast(dateIn(birth + ri(15, age))));
			return;
		}
		const r = rnd();
		if (fresh) {
			if (r < 0.25) addFaithEv(p.id, '세례', clampPast(dateIn(birth + ri(20, age))), `가상교회${ri(1, 9)}`);
			else if (r < 0.65) p.faith_checked_on = reg;
			return;
		}
		if (r < 0.88) addFaithEv(p.id, '세례', clampPast(dateIn(Math.min(THIS_YEAR - 1, birth + ri(16, Math.max(17, Math.min(age, 45)))))));
		else if (r < 0.94) addFaithEv(p.id, '학습', clampPast(dateIn(THIS_YEAR - ri(1, 5))));
	}

	// 직분 이력: 나이와 성별로 가능성을 정함 (임직일은 나이에서 거꾸로 계산)
	function giveOffice(p: T.Person, birth: number) {
		const age = ageAt(birth);
		const male = p.gender === 'M';
		const y = (a: number) => dateIn(birth + a);
		if (male && age >= 50 && chance(0.08)) { // 장로
			const sa = ri(48, Math.min(60, age - 1));
			if (chance(0.7)) addOffice(p.id, '시무집사', '시무', y(sa - ri(6, 12)), y(sa));
			if (age >= 71) {
				addOffice(p.id, '장로', '시무', y(sa), y(70));
				addOffice(p.id, '장로', chance(0.12) ? '원로' : '은퇴', y(70).replace(/^\d+/, String(birth + 71)));
			} else addOffice(p.id, '장로', '시무', y(sa));
			return;
		}
		if (male && age >= 42 && chance(0.12)) { // 시무집사
			const sa = ri(40, Math.min(60, age - 1));
			addOffice(p.id, '서리집사', '시무', y(sa - ri(3, 8)), y(sa));
			if (age >= 71) { addOffice(p.id, '시무집사', '시무', y(sa), y(70)); addOffice(p.id, '시무집사', '은퇴', `${birth + 71}-01-07`); }
			else addOffice(p.id, '시무집사', '시무', y(sa));
			return;
		}
		if (!male && age >= 50 && chance(0.3)) { // 권사
			const sa = ri(48, Math.min(62, age - 1));
			if (age >= 71) { addOffice(p.id, '권사', '시무', y(sa), y(70)); addOffice(p.id, '권사', '은퇴', `${birth + 71}-01-07`); }
			else addOffice(p.id, '권사', '시무', y(sa));
			return;
		}
		if (age >= 35 && chance(male ? 0.14 : 0.17)) addOffice(p.id, '서리집사', '시무', y(ri(33, Math.min(55, age - 1))));
	}

	function newHousehold(address = true): T.Household {
		const n = ++nH;
		const h: T.Household = {
			id: `gh${n}`, no: `H-${String(n).padStart(3, '0')}`, zip: address ? '00000' : null,
			address: address ? `가상시 가상구 가상로 ${n * 3}` : null, home_phone: chance(0.25) ? `02-000-${1000 + n}` : null, note: null
		};
		households.push(h);
		return h;
	}
	function join(h: T.Household, p: T.Person | null, relation: string, extra: Partial<T.HouseholdMember> = {}) {
		householdMembers.push({
			id: eid('hm'), household_id: h.id, person_id: p?.id ?? null, name: '', birth_year: null, relation,
			sort_order: householdMembers.filter((m) => m.household_id === h.id).length + 1, note: null, ...extra
		});
	}

	// 소그룹 배정 + 출석 성향
	function assignGroup(p: T.Person, birth: number, forceGroup?: GroupDef) {
		const ci = commOf(birth);
		const g = forceGroup ?? pickGroup(ci);
		personGroups.push({ person_id: p.id, community: COMMUNITY_DEFS[ci].name, small_group: g.name });
		attendRate[p.id] = Math.min(0.99, 0.5 + rnd() * 0.5);
	}

	// ----- 한 세대 만들기 -----
	type Kind = 'couple_kids' | 'couple' | 'single' | 'single_parent' | 'three_gen';
	function makeHousehold(headBirth: number, kind: Kind, fresh: 'recent' | 'year' | null = null) {
		const h = newHousehold();
		const surname = pick(SUR);
		const headMale = kind === 'single_parent' ? chance(0.2) : kind === 'single' ? chance(0.5) : kind === 'three_gen' ? chance(0.85) : chance(0.8);
		const reg = fresh === 'recent' ? daysAgo(ri(2, 58)) : fresh === 'year' ? daysAgo(ri(62, 330)) : clampPast(dateBetween(`${Math.max(1990, headBirth + 22)}-01-01`, daysAgo(120)));
		const reason = fresh ? '새가족' : null;
		const ex = chance(0.18) && !fresh;
		const prevChurch = fresh ? chance(0.45) : false;
		const wedYear = headBirth + ri(25, 31);
		const wedding = kind === 'couple_kids' || kind === 'couple' || kind === 'three_gen' ? dateIn(Math.min(wedYear, THIS_YEAR - 1)) : null;
		const members: { p: T.Person; birth: number }[] = [];
		const register = (p: T.Person, birth: number, when: string) => {
			const transfer = !fresh && ex && ageAt(birth) >= 20;
			if (transfer) addStatus(p.id, '전입', when, null, `가상교회${ri(1, 9)}`);
			else addStatus(p.id, '등록', when, reason);
			giveFaith(p, birth, when, !!fresh);
			if (!fresh && ageAt(birth) >= 18) {
				giveOffice(p, birth);
				// 직분자는 세례(입교)를 받은 사람
				const holds = officeTerms.some((o) => o.person_id === p.id);
				if (holds && !faithEvents.some((f) => f.person_id === p.id && (f.kind === '세례' || f.kind === '입교'))) {
					addFaithEv(p.id, '세례', dateIn(birth + ri(18, 30)));
				}
			}
			members.push({ p, birth });
		};

		const head = mkPerson({
			surname, gender: headMale ? 'M' : 'F', birth: headBirth, reg, fresh: !!fresh, previous: prevChurch,
			marital: kind === 'single' ? (headBirth < 1960 ? '사별' : '미혼') : kind === 'single_parent' ? '기타' : '기혼', wedding
		});
		register(head, headBirth, reg);
		join(h, head, '본인');

		let spouse: T.Person | null = null;
		if (kind === 'couple_kids' || kind === 'couple' || kind === 'three_gen') {
			const sb = headBirth + ri(-4, 4);
			spouse = mkPerson({ surname: pick(SUR), gender: headMale ? 'F' : 'M', birth: sb, reg, fresh: !!fresh, previous: prevChurch, marital: '기혼', wedding });
			register(spouse, sb, reg);
			join(h, spouse, '배우자');
		}

		const kidsN = kind === 'couple_kids' ? ri(1, 3) : kind === 'single_parent' ? ri(1, 2) : kind === 'three_gen' ? ri(1, 2) : 0;
		const kids: { p: T.Person; birth: number }[] = [];
		for (let i = 0; i < kidsN; i++) {
			const kb = headBirth + ri(24, 38);
			if (kb > THIS_YEAR) continue;
			const kreg = reg > `${kb}-06-30` ? reg : dateBetween(`${kb}-03-01`, `${kb}-12-28`);
			const k = mkPerson({ surname: head.gender === 'M' ? surname : pick(SUR), gender: chance(0.5) ? 'M' : 'F', birth: kb, reg: kreg, marital: '미혼' });
			register(k, kb, clampPast(kreg));
			join(h, k, '자녀');
			kids.push({ p: k, birth: kb });
		}
		// 3대: 부모님 한 분
		if (kind === 'three_gen') {
			const pb = headBirth - ri(24, 32);
			if (pb > 1925) {
				const par = mkPerson({ surname: head.gender === 'M' ? surname : pick(SUR), gender: chance(0.7) ? 'F' : 'M', birth: pb, reg, marital: '사별' });
				register(par, pb, reg);
				join(h, par, '부모');
			}
		}
		// 교인이 아닌 세대원 (부모·형제)
		if (!fresh && chance(0.07)) join(h, null, pick(['부모', '형제자매']), { name: makeName(pick(SUR), 'M', 1950), birth_year: ri(1935, 1965), note: '교인 아님' });

		// ----- 소그룹 -----
		const baseGroup = (b: number) => ageAt(b) >= 20 && chance([0.93, 0.85, 0.5][commOf(b)]);
		let pairGroup: GroupDef | undefined;
		for (const m of members) {
			const a = ageAt(m.birth);
			if (a < 20) continue;
			if (!baseGroup(m.birth)) continue;
			// 부부는 같은 소그룹
			const isCouple = (m.p === head || m.p === spouse) && spouse;
			if (isCouple) {
				if (!pairGroup || commOf(m.birth) !== commOf(headBirth)) pairGroup = pickGroup(commOf(m.birth));
				assignGroup(m.p, m.birth, pairGroup);
			} else assignGroup(m.p, m.birth);
		}
		// 로뎀나무숲: 열매 공동체 부모의 어린 자녀
		for (const k of kids) {
			const a = ageAt(k.birth);
			if (a >= 3 && a <= 12 && [head, spouse].some((x) => x && commOf(Number(x.birth_date!.slice(0, 4))) === 2 && personGroups.some((g) => g.person_id === x.id)) && chance(0.7)) {
				assignGroup(k.p, k.birth, COMMUNITY_DEFS[2].groups.find((g) => g.care)!);
				personGroups[personGroups.length - 1].community = COMMUNITY_DEFS[2].name;
			}
		}
		return { head, members };
	}

	const commKinds = (c: number, headBirth: number): Kind => {
		const r = rnd();
		if (c === 0) return r < 0.42 ? 'couple' : r < 0.78 ? 'single' : 'three_gen';
		if (c === 1) return r < 0.52 ? 'couple_kids' : r < 0.68 ? 'couple' : r < 0.82 ? 'three_gen' : r < 0.92 ? 'single' : 'single_parent';
		if (headBirth >= 1990) return r < 0.58 ? 'single' : r < 0.78 ? 'couple' : 'couple_kids';
		return r < 0.72 ? 'couple_kids' : r < 0.84 ? 'couple' : r < 0.92 ? 'single_parent' : 'single';
	};
	const headBirthFor = (c: number) => (c === 0 ? ri(1930, 1955) : c === 1 ? ri(1956, 1970) : chance(0.3) ? ri(1990, 2003) : ri(1971, 1989));

	// 일반 세대
	const actives = () => statusEvents.filter((e) => e.kind === '등록' || e.kind === '전입').length;
	while (actives() < 960) {
		const c = pick([0, 0, 0, 0, 1, 1, 1, 1, 1, 2, 2, 2]);
		const hb = headBirthFor(c);
		makeHousehold(hb, commKinds(c, hb));
	}
	// 새가족: 최근 60일 안에 등록 16세대, 그 전 1년 안에 등록 24세대
	const freshMembers: T.Person[] = [];
	for (let i = 0; i < 40; i++) {
		const hb = chance(0.2) ? ri(1960, 1975) : ri(1976, 2002);
		const k: Kind = hb >= 1990 ? pick(['single', 'single', 'couple', 'couple_kids']) : pick(['couple_kids', 'couple', 'single']);
		const r = makeHousehold(hb, k, i < 10 ? 'recent' : 'year');
		freshMembers.push(...r.members.map((m) => m.p));
	}
	// 새가족 인도자·동의 기록
	const guides = people.filter((p) => ageAt(Number(p.birth_date!.slice(0, 4))) >= 30 && personGroups.some((g) => g.person_id === p.id) && !freshMembers.includes(p));
	for (const p of freshMembers) {
		const first = statusEvents.find((e) => e.person_id === p.id)!;
		if (ageAt(Number(p.birth_date!.slice(0, 4))) >= 14 && chance(0.8)) p.guide_person_id = pick(guides).id;
		else if (chance(0.3)) p.guide_name = '지인 소개';
		const d = first.event_date ?? TODAY;
		consents.push({ id: eid('c'), person_id: p.id, kind: '교적 등록', policy_version: '2026-01', consent_date: d, method: '서면', guardian_name: null, revoked_on: null });
		if (chance(0.6)) consents.push({ id: eid('c'), person_id: p.id, kind: '요람 공개', policy_version: '2026-01', consent_date: d, method: '서면', guardian_name: null, revoked_on: null });
	}

	// 보류(소식이 뜸한 교인)
	const activeAdults = people.filter((p) => ageAt(Number(p.birth_date!.slice(0, 4))) >= 25 && !freshMembers.includes(p));
	for (let i = 0; i < 30; i++) {
		const p = pick(activeAdults);
		if (statusEvents.some((e) => e.person_id === p.id && e.kind === '보류')) continue;
		addStatus(p.id, '보류', daysAgo(ri(40, 900)), pick(['장기 결석', '연락 두절', '해외 체류']));
		const gi = personGroups.findIndex((g) => g.person_id === p.id);
		if (gi >= 0) personGroups.splice(gi, 1);
	}

	// 전출·별세·제적 (재적에서 빠진 사람)
	const gone = (kind: '전출' | '별세' | '제적', n: number) => {
		for (let i = 0; i < n; i++) {
			const hb = kind === '별세' ? ri(1928, 1948) : ri(1950, 2000);
			const h = newHousehold();
			const male = chance(0.5);
			const p = mkPerson({ surname: pick(SUR), gender: male ? 'M' : 'F', birth: hb, reg: null, marital: kind === '별세' ? '사별' : null });
			const reg = dateBetween(`${Math.max(1990, hb + 25)}-01-01`, daysAgo(900));
			addStatus(p.id, '등록', reg);
			if (kind === '제적') addStatus(p.id, '보류', dateBetween(reg, daysAgo(500)), '장기 결석');
			const at = dateBetween(daysAgo(kind === '별세' ? 1500 : 1000), daysAgo(20));
			addStatus(p.id, kind, at, kind === '전출' ? pick(['이사', '직장 이동', '교회 이전']) : kind === '별세' ? null : '장기 소식 두절', kind === '전출' ? `가상교회${ri(1, 9)}` : null);
			giveFaith(p, hb, reg, false);
			join(h, p, '본인');
		}
	};
	gone('전출', 34); gone('별세', 8); gone('제적', 26);

	// 같은 이름 구분
	const byName = new Map<string, T.Person[]>();
	for (const p of people) byName.set(p.name, [...(byName.get(p.name) ?? []), p]);
	for (const list of byName.values()) if (list.length > 1) for (const p of list) p.name_note = `${p.birth_date!.slice(0, 4)}년생`;

	// 장기 결석 대상(재적·소그룹 있는 사람 중 일부)
	const grouped = people.filter((p) => personGroups.some((g) => g.person_id === p.id && g.small_group !== '로뎀나무숲') && ageAt(Number(p.birth_date!.slice(0, 4))) >= 30);
	for (let i = 0; i < 14; i++) absentStreak[pick(grouped).id] = ri(3, 9);

	// 심방(교역자 열람용), 담당자 메모, 디모데 메모, 소속
	const activeIds = people.filter((p) => {
		const last = statusEvents.filter((e) => e.person_id === p.id).at(-1);
		return last && (last.kind === '등록' || last.kind === '전입');
	});
	const VISIT = ['가정 방문, 안부 확인 후 기도', '전화로 안부를 묻고 기도 제목 확인', '병원 방문, 위로와 기도', '새가족 가정 방문, 교회 안내', '이사 후 가정 예배', '직장 방문, 격려'];
	const FOLLOW = ['2주 뒤 연락', '소그룹 리더와 공유', '다음 달 재방문', null, null, null];
	for (let i = 0; i < 70; i++) {
		const p = pick(activeIds);
		visits.push({ id: eid('vi'), person_id: p.id, visit_date: daysAgo(ri(3, 360)), visitor: pick(['담당 교역자', '담임목사', '부교역자']), content: pick(VISIT), follow_up: pick(FOLLOW) });
	}
	visits.sort((a, b) => b.visit_date.localeCompare(a.visit_date));
	const NOTE = ['전화 연결 안 됨. 소그룹 리더가 안부 확인 예정.', '주소 변경 안내 받음. 세대 주소 확인 필요.', '앱 가입 안내 완료.', '요람 공개 여부 재확인 필요.', '새가족 교육 안내 완료.'];
	for (let i = 0; i < 18; i++) notes.push({ id: eid('n'), person_id: pick(activeIds).id, body: pick(NOTE), author: '교적 담당 간사', created_at: daysAgo(ri(1, 200)) });
	const MEMO = ['(디모데) 이사 후 주소 변경 요청', '(디모데) 가족 중 비신자가 있음', '(디모데) 부부 소그룹 분리 희망', '(디모데) 직장 이동으로 주일 참석이 불규칙'];
	for (let i = 0; i < 60; i++) legacyMemos.push({ id: eid('lm'), person_id: pick(activeIds).id, body: pick(MEMO) });
	const ORGS: [string, string[]][] = [['찬양대', ['대원', '파트장']], ['미디어부', ['부원']], ['주차 안내', ['봉사자']], ['주방 봉사', ['봉사자']], ['교회학교 교사', ['교사']], ['새가족부', ['팀원']], ['선교회', ['회원', '총무']]];
	for (let i = 0; i < 130; i++) {
		const p = pick(activeIds);
		if (ageAt(Number(p.birth_date!.slice(0, 4))) < 20) continue;
		const [org, roles] = pick(ORGS);
		affiliations.push({ id: eid('af'), person_id: p.id, org, role: pick(roles), start_date: dateIn(THIS_YEAR - ri(0, 8)), end_date: null });
	}

	// 가상 출석부 자료와 맞추기: 결석이 이어지는 사람은 평소 출석률도 낮게
	for (const id of Object.keys(absentStreak)) attendRate[id] = 0.45;

	return {
		people, households, householdMembers, statusEvents, faithEvents, officeTerms, personGroups, notes, legacyMemos, consents, visits, affiliations,
		absentStreak, attendRate
	};
}
