<script lang="ts">
	import { goto } from '$app/navigation';
	import { registry } from '#lib/registry/store.svelte.ts';

	let q = $state('');
	const rows = $derived(
		registry.d.households.filter((h) => {
			if (!q) return true;
			const names = registry.membersOfHousehold(h.id).map((m) => (m.person_id ? registry.person(m.person_id)?.name : m.name) ?? '');
			return h.no.includes(q) || (h.address ?? '').includes(q) || names.some((n) => n.includes(q));
		})
	);
	const head = (hid: string) => {
		const m = registry.membersOfHousehold(hid).find((x) => x.relation === '본인');
		return m?.person_id ? registry.person(m.person_id)?.name : m?.name ?? '-';
	};
	const noHousehold = $derived(registry.d.people.filter((p) => !registry.memberOf(p.id)));

	function create() {
		const h = registry.createHousehold(null);
		goto(`/registry/households/${h.id}`);
	}
</script>

<div class="row" style="justify-content:space-between">
	<h1>세대 <small class="muted">({rows.length})</small></h1>
	{#if registry.perms.edit}<button onclick={create}>+ 세대 만들기</button>{/if}
</div>
<div class="toolbar"><input type="search" placeholder="세대번호·주소·세대원 이름 검색" bind:value={q} /></div>
<div class="card" style="padding:0">
	<table>
		<thead><tr><th>세대번호</th><th>세대주</th><th>세대원</th><th>주소</th></tr></thead>
		<tbody>
			{#each rows as h (h.id)}
				<tr>
					<td><a href="/registry/households/{h.id}">{h.no}</a></td>
					<td>{head(h.id)}</td>
					<td>{registry.membersOfHousehold(h.id).length}명</td>
					<td>{h.address ?? '-'}</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
{#if noHousehold.length}
	<div class="card">
		<h2>아직 세대가 없는 교인 ({noHousehold.length}명)</h2>
		<p class="muted">디모데 가져오기와 담당자 입력으로 채우는 중이라 세대가 없는 사람이 많을 수 있습니다.</p>
		{#each noHousehold as p}<a href="/registry/{p.id}" style="margin-right:.8rem">{p.name}</a>{/each}
	</div>
{/if}
