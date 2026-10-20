<script lang="ts">
	import { registry } from '#lib/registry/store.svelte.ts';
	import { recentSundays } from '#lib/registry/attendance.mock.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';

	const WEEKS = recentSundays(8);
	const latest = WEEKS[WEEKS.length - 1];

	// 소그룹별 인원·이번 주 출석
	const stat = $derived.by(() => {
		const m = new Map<string, { total: number; present: number }>();
		for (const g of registry.d.personGroups) {
			const p = registry.person(g.person_id);
			if (!p || !registry.summary(p).memberCert) continue;
			const cur = m.get(g.small_group) ?? { total: 0, present: 0 };
			cur.total++;
			if (registry.attended(p.id, latest, 0)) cur.present++;
			m.set(g.small_group, cur);
		}
		return m;
	});
	const groups = $derived(registry.d.smallGroups);
	const nameOf = (id: string | null) => (id ? registry.person(id)?.name ?? '' : '');
	const sum = (c: string) => {
		let t = 0, p = 0;
		for (const g of groups.filter((x) => x.community === c)) { t += stat.get(g.name)?.total ?? 0; p += stat.get(g.name)?.present ?? 0; }
		return { t, p };
	};
</script>

<div class="row" style="justify-content:space-between">
	<h1>공동체 편성표 <small class="muted">3개 공동체 · 소그룹 {groups.filter((g) => !g.care).length}개 + 자녀 돌봄</small></h1>
	<a class="btn" href="/attendance">주일 출석 등록</a>
</div>
<p class="muted" style="margin-top:-.6rem">공동체와 소그룹 편성, 출석부는 지금 운영 중인 출석부 자료를 그대로 가져와 보여 줍니다. (이 화면의 출석은 가상 샘플)</p>

{#each COMMUNITY_DEFS as c}
	{@const t = sum(c.name)}
	<div class="card" style="padding:0">
		<div class="card-head" style="padding:1.1rem 1.3rem 0">
			<div><h2>{c.name} <span class="tag">{c.born}</span></h2>
				<span class="sub">재적 {t.t}명 · {WEEKS[7].slice(5).replace('-', '/')} 출석 {t.p}명 ({t.t ? Math.round((t.p * 100) / t.t) : 0}%)</span></div>
		</div>
		<div style="overflow-x:auto">
			<table class="sm">
				<thead><tr><th>소그룹</th><th>인도자</th><th>모임 장소</th><th>인원</th><th>이번 주 출석</th></tr></thead>
				<tbody>
					{#each groups.filter((g) => g.community === c.name).sort((a, b) => a.sort_order - b.sort_order) as g (g.id)}
						{@const s = stat.get(g.name)}
						<tr>
							<td><a href="/communities/{encodeURIComponent(g.name)}"><b>{g.name}</b></a>{#if g.care}<span class="tag part">자녀 돌봄</span>{/if}</td>
							<td>{#if g.leader_id}<a href="/{g.leader_id}">{nameOf(g.leader_id)}</a>{:else}<span class="muted">-</span>{/if}</td>
							<td>{g.place ?? '-'}</td>
							<td>{s?.total ?? 0}명</td>
							<td style="min-width:150px">
								{#if s}<div class="row" style="gap:.6rem;flex-wrap:nowrap"><div class="track" style="flex:1"><i style="width:{(s.present * 100) / s.total}%"></i></div><span class="muted" style="font-size:.8rem;white-space:nowrap">{s.present}/{s.total}</span></div>{:else}-{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
{/each}
