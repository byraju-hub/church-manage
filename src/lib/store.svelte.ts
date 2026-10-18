// 프로토타입용 데이터 저장소: 브라우저 localStorage 에 저장합니다.
// 실제 구현 시 이 파일의 메서드들을 Supabase 호출로 교체하면 됩니다.
const browser = typeof localStorage !== 'undefined';
import * as seed from './mock/seed.ts';
import type { Family, Group, Member, Visit } from './types.ts';

const KEY = 'church-manage-proto-v1';

interface Data {
	groups: Group[];
	families: Family[];
	members: Member[];
	visits: Visit[];
}

function initial(): Data {
	return structuredClone({
		groups: seed.groups,
		families: seed.families,
		members: seed.members,
		visits: seed.visits
	});
}

function load(): Data {
	if (browser) {
		try {
			const raw = localStorage.getItem(KEY);
			if (raw) return JSON.parse(raw);
		} catch {}
	}
	return initial();
}

class Store {
	data = $state<Data>(load());

	private persist() {
		if (browser) {
			try {
				localStorage.setItem(KEY, JSON.stringify(this.data));
			} catch {}
		}
	}

	get members() { return this.data.members; }
	get groups() { return this.data.groups; }
	get families() { return this.data.families; }

	member(id: string) { return this.data.members.find((x) => x.id === id); }
	group(id: string | null) { return this.data.groups.find((x) => x.id === id); }
	family(id: string | null) { return this.data.families.find((x) => x.id === id); }
	familyMembers(id: string | null) { return id ? this.data.members.filter((x) => x.family_id === id) : []; }
	visitsOf(memberId: string) {
		return this.data.visits.filter((x) => x.member_id === memberId).sort((a, b) => b.visit_date.localeCompare(a.visit_date));
	}

	saveMember(m: Member) {
		const i = this.data.members.findIndex((x) => x.id === m.id);
		if (i >= 0) this.data.members[i] = m;
		else this.data.members.push(m);
		this.persist();
	}

	deleteMember(id: string) {
		this.data.members = this.data.members.filter((x) => x.id !== id);
		this.data.visits = this.data.visits.filter((x) => x.member_id !== id);
		this.persist();
	}

	addVisit(v: Omit<Visit, 'id'>) {
		this.data.visits.push({ ...v, id: crypto.randomUUID() });
		this.persist();
	}

	reset() {
		this.data = initial();
		this.persist();
	}
}

export const store = new Store();
