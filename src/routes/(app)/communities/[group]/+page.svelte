<script lang="ts">
	// 소그룹 상세: 출석 추이, 인도자 특이사항(심방 권한자만), 구성원 8주 출석
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';
	import { recentSundays } from '#lib/registry/attendance.mock.ts';

	const WEEKS = recentSundays(8);
	const g = $derived(registry.groupDef(decodeURIComponent(page.params.group!)));
	const members = $derived(
		g ? registry.membersOfGroup(g.name)
			.map((p) => ({ p, s: registry.summary(p) }))
			.filter((x) => x.s.memberCert)
			// 인도자를 맨 위에, 나머지는 가나다순
			.sort((a, b) => Number(b.p.id === g.leader_id) - Number(a.p.id === g.leader_id) || a.p.name.localeCompare(b.p.name, 'ko')) : []
	);
	const weekly = $derived(WEEKS.map((d, i) => ({ d, n: members.filter(({ p }) => registry.groupAttended(p.id, d, WEEKS.length - 1 - i)).length })));
	const maxN = $derived(Math.max(1, ...weekly.map((w) => w.n)));
	const notes = $derived(g ? registry.d.groupNotes.filter((n) => n.small_group === g.name) : []);
	const nameOf = (id: string | null) => (id ? registry.person(id)?.name ?? '' : '');
	let noteFor = $state('');
	let noteBody = $state('');
	const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
</script>

{#if g}
	<div class="row" style="justify-content:space-between">
		<h1>{g.name} <small class="muted">&nbsp;[ {g.community} ]</small></h1>
		<div class="row"><a class="btn ghost" href="/communities">← 편성표</a></div>
	</div>

	<div class="kpis">
		<div class="kpi"><div><b>{members.length}</b><span>재적 인원</span></div></div>
		<div class="kpi"><div><b>{g.leader_id ? nameOf(g.leader_id) : '-'}</b><span>인도자{g.leader_id ? '' : ' (미정)'}</span></div></div>
		<div class="kpi"><div><b style="font-size:1.2rem">{g.place ?? '-'}</b><span>모임 장소</span></div></div>
		<div class="kpi"><div><b>{weekly[7].n}<small class="muted" style="font-size:.9rem"> / {members.length}</small></b><span>이번 주일 소그룹 모임 출석</span></div></div>
	</div>

	<div class="dash-grid even" style={registry.perms.visit ? undefined : 'grid-template-columns:1fr'}>
		<section class="card">
			<div class="card-head"><h2>소그룹 모임 출석 추이</h2><span class="sub">최근 8주 · 홈페이지 출석부(인도자 등록)</span></div>
			<div class="spark">
				{#each weekly as w}
					<div class="col"><span>{w.n}</span><i style="height:{(w.n * 100) / maxN}%"></i><small>{md(w.d)}</small></div>
				{/each}
			</div>
		</section>
		{#if registry.perms.visit}
		<section class="card">
			<div class="card-head"><h2>인도자 특이사항</h2><span class="sub">출석부에서 인도자가 적는 개별 메모 · A 등급만</span></div>
			{#each notes.slice(0, 8) as n (n.id)}
				<div class="li">
					<span class="avatar warm">{nameOf(n.person_id).slice(0, 1)}</span>
					<div class="grow"><b><a href="/{n.person_id}">{nameOf(n.person_id)}</a></b><small>{n.date} · {n.author} — {n.body}</small></div>
				</div>
			{:else}<p class="empty">적힌 특이사항이 없습니다.</p>{/each}
			{#if registry.perms.edit}
				<form class="row" style="margin-top:.8rem;flex-wrap:nowrap" onsubmit={(e) => { e.preventDefault(); if (noteFor && noteBody.trim()) { registry.addGroupNote({ person_id: noteFor, small_group: g!.name, date: new Date().toISOString().slice(0, 10), body: noteBody.trim(), author: nameOf(g!.leader_id) || '인도자' }); noteBody = ''; } }}>
					<select bind:value={noteFor} style="width:9rem"><option value="">교인 선택</option>{#each members as { p }}<option value={p.id}>{p.name}</option>{/each}</select>
					<input bind:value={noteBody} placeholder="특이사항 입력" /><button type="submit">추가</button>
				</form>
			{/if}
		</section>
		{/if}
	</div>

	<div class="card" style="padding:0;overflow-x:auto">
		<table class="sm">
			<thead><tr><th>이름</th><th>직분</th><th>신급</th><th>휴대폰</th>{#each WEEKS as d}<th style="text-align:center">{md(d)}</th>{/each}</tr></thead>
			<tbody>
				{#each members as { p, s } (p.id)}
					<tr>
						<td><a href="/{p.id}">{p.name}</a>{#if p.id === g.leader_id}<span class="tag now">인도자</span>{/if}</td>
						<td>{s.title || '-'}</td><td>{s.faith}</td><td>{p.phone ?? '-'}</td>
						{#each WEEKS as d, i}
							{@const ok = registry.groupAttended(p.id, d, WEEKS.length - 1 - i)}
							<td style="text-align:center"><span class="pdot" class:on={ok}></span></td>
						{/each}
					</tr>
				{:else}<tr><td colspan="12" class="muted">소속 교인이 없습니다.</td></tr>{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p>소그룹을 찾을 수 없습니다. <a href="/communities">편성표로</a></p>
{/if}
