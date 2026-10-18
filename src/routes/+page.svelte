<script lang="ts">
	import { store } from '#lib/store.svelte.ts';
	import { STATUS_LABEL } from '#lib/types.ts';

	const ms = $derived(store.members);
	const count = (s: string) => ms.filter((m) => m.status === s).length;
	const age = (d: string | null) => (d ? new Date().getFullYear() - +d.slice(0, 4) : null);
	const upcoming = $derived.by(() => {
		const today = new Date();
		return ms
			.filter((m) => m.birth_date && m.status !== 'deceased' && m.status !== 'transferred')
			.map((m) => {
				const [, mo, da] = m.birth_date!.split('-').map(Number);
				let next = new Date(today.getFullYear(), mo - 1, da);
				if (next < new Date(today.getFullYear(), today.getMonth(), today.getDate()))
					next = new Date(today.getFullYear() + 1, mo - 1, da);
				return { m, next, days: Math.round((+next - +today) / 864e5) };
			})
			.sort((a, b) => +a.next - +b.next)
			.slice(0, 5);
	});
</script>

<h1>대시보드</h1>
<div class="grid">
	<div class="stat"><b>{ms.length}</b><span>전체 명부</span></div>
	{#each ['active', 'newcomer', 'inactive', 'transferred'] as s}
		<div class="stat"><b>{count(s)}</b><span>{STATUS_LABEL[s as keyof typeof STATUS_LABEL]}</span></div>
	{/each}
</div>

<div class="card">
	<h2>다가오는 생일</h2>
	<table>
		<tbody>
			{#each upcoming as u}
				<tr>
					<td><a href="/members/{u.m.id}">{u.m.name}</a></td>
					<td>{u.m.birth_date}</td>
					<td class="muted">{u.days === 0 ? '오늘' : `${u.days}일 후`} · 만 {age(u.m.birth_date)! + (u.next.getFullYear() - new Date().getFullYear())}세</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
