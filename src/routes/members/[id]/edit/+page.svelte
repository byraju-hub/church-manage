<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { store } from '#lib/store.svelte.ts';
	import MemberForm from '#lib/components/MemberForm.svelte';
	import type { Member } from '#lib/types.ts';

	const m = $derived(store.member(page.params.id!));

	function save(updated: Member) {
		store.saveMember(updated);
		goto(`/members/${updated.id}`);
	}
</script>

{#if m}
	<h1>{m.name} 수정</h1>
	{#key m.id}<MemberForm initial={m} onsave={save} />{/key}
{:else}
	<p>교인을 찾을 수 없습니다. <a href="/members">목록으로</a></p>
{/if}
