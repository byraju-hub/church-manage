<script lang="ts">
	import { store } from '#lib/store.svelte.ts';
	import { STATUS_LABEL, POSITIONS } from '#lib/types.ts';

	let q = $state('');
	let status = $state('');
	let group = $state('');
	let position = $state('');

	const list = $derived(
		store.members.filter(
			(m) =>
				(!q || m.name.includes(q) || (m.phone ?? '').replace(/-/g, '').includes(q.replace(/-/g, ''))) &&
				(!status || m.status === status) &&
				(!group || m.group_id === group) &&
				(!position || m.position === position)
		)
	);
</script>

<div class="row" style="justify-content:space-between">
	<h1>교인 관리 <small class="muted">({list.length}명)</small></h1>
	<a class="btn" href="/members/new">+ 교인 등록</a>
</div>

<div class="toolbar">
	<input type="search" placeholder="이름 또는 전화번호 검색" bind:value={q} />
	<select bind:value={status}>
		<option value="">상태 전체</option>
		{#each Object.entries(STATUS_LABEL) as [k, v]}<option value={k}>{v}</option>{/each}
	</select>
	<select bind:value={group}>
		<option value="">구역 전체</option>
		{#each store.groups as g}<option value={g.id}>{g.name}</option>{/each}
	</select>
	<select bind:value={position}>
		<option value="">직분 전체</option>
		{#each POSITIONS as p}<option value={p}>{p}</option>{/each}
	</select>
</div>

<div class="card" style="padding:0;overflow-x:auto">
	<table>
		<thead><tr><th>이름</th><th>직분</th><th>구역</th><th>가정</th><th>연락처</th><th>상태</th></tr></thead>
		<tbody>
			{#each list as m (m.id)}
				<tr>
					<td><a href="/members/{m.id}">{m.name}</a></td>
					<td>{m.position ?? '-'}</td>
					<td>{store.group(m.group_id)?.name ?? '-'}</td>
					<td>{store.family(m.family_id)?.name ?? '-'}</td>
					<td>{m.phone ?? '-'}</td>
					<td><span class="badge {m.status}">{STATUS_LABEL[m.status]}</span></td>
				</tr>
			{:else}
				<tr><td colspan="6" class="muted">검색 결과가 없습니다.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
