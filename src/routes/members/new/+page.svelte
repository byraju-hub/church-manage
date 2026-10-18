<script lang="ts">
	import { goto } from '$app/navigation';
	import { store } from '#lib/store.svelte.ts';
	import MemberForm from '#lib/components/MemberForm.svelte';
	import type { Member } from '#lib/types.ts';

	const blank: Member = {
		id: crypto.randomUUID(), name: '', gender: null, birth_date: null, phone: null, email: null, address: null,
		family_id: null, family_relation: null, group_id: null, status: 'newcomer', position: null,
		registered_at: new Date().toISOString().slice(0, 10), baptism_type: 'none', baptism_date: null,
		previous_church: null, memo: null
	};

	function save(m: Member) {
		store.saveMember(m);
		goto(`/members/${m.id}`);
	}
</script>

<h1>교인 등록</h1>
<MemberForm initial={blank} onsave={save} />
