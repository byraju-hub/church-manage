<script lang="ts">
	// 교회 조직: 당회 · 시무집사회 · 시무권사회 · 남/여전도회 · 교회 조직표
	import { registry } from '#lib/registry/store.svelte.ts';
	import { MISSION_SOCIETIES } from '#lib/registry/types.ts';

	const tabs = ['당회', '시무집사회', '시무권사회', '남전도회', '여전도회', '교회 조직표'];
	let tab = $state('당회');
	let pickedSociety = $state('1남전도회');
	let pickedOrg = $state('');

	// 직분회: 지금 시무 중인 사람만
	const holders = (office: string) =>
		registry.d.officeTerms
			.filter((t) => t.office === office && !t.end_date && t.rank_status === '시무')
			.map((t) => ({ t, p: registry.person(t.person_id)!, s: registry.summary(registry.person(t.person_id)!) }))
			.filter((x) => x.p && x.s.memberCert)
			.sort((a, b) => (a.t.start_date ?? '').localeCompare(b.t.start_date ?? '') || a.p.name.localeCompare(b.p.name, 'ko'));
	const others = (office: string) =>
		registry.d.officeTerms
			.filter((t) => t.office === office && !t.end_date && t.rank_status !== '시무' && t.rank_status !== '사임')
			.map((t) => ({ t, p: registry.person(t.person_id)! }))
			.filter((x) => x.p);

	const society = $derived(
		(name: string) => registry.d.people.filter((p) => p.mission_society === name && registry.summary(p).memberCert)
	);
	const males = MISSION_SOCIETIES.filter((s) => s.includes('남'));
	const females = MISSION_SOCIETIES.filter((s) => s.includes('여'));
	const count = (name: string) => society(name).length;

	const units = $derived(registry.d.orgUnits);
	const committees = $derived(units.filter((u) => !u.parent_id).sort((a, b) => a.sort_order - b.sort_order));
	const deptMembers = (name: string) => registry.d.affiliations.filter((a) => a.org === name && !a.end_date);
	const nameOf = (id: string) => registry.person(id)?.name ?? '';
</script>

<h1>교회 조직</h1>
<div class="tabs">{#each tabs as t}<button class:on={tab === t} onclick={() => (tab = t)}>{t}</button>{/each}</div>

{#if tab === '당회' || tab === '시무집사회' || tab === '시무권사회'}
	{@const office = tab === '당회' ? '장로' : tab === '시무집사회' ? '시무집사' : '권사'}
	{@const list = holders(office)}
	<div class="card">
		<div class="card-head"><h2>{tab} <span class="tag">{office} 시무 {list.length}명</span></h2><span class="sub">{office === '장로' ? '장로 중 시무장로인 교인입니다.' : office === '시무집사' ? '집사 중 시무집사인 교인입니다.' : '권사 중 시무권사인 교인입니다.'}</span></div>
		<div class="org-grid">
			{#each list as { t, p } (t.id)}
				<a class="org-card" href="/{p.id}" style="text-decoration:none"><b>{p.name} {office === '시무집사' ? '집사' : office}</b><span>임직 {t.start_date ?? '미상'}{t.church ? ` · ${t.church}` : ''}</span></a>
			{:else}<p class="empty">해당자가 없습니다.</p>{/each}
		</div>
	</div>
	{@const rest = others(office)}
	{#if rest.length}
		<div class="card">
			<h2>그 밖의 구분 <span class="muted" style="font-weight:400">(은퇴 · 원로 · 명예 · 협동 · 전입)</span></h2>
			<table class="sm"><thead><tr><th>이름</th><th>구분</th><th>시작</th><th>임직교회</th></tr></thead><tbody>
				{#each rest as { t, p } (t.id)}<tr><td><a href="/{p.id}">{p.name}</a></td><td>{t.rank_status}{office}</td><td>{t.start_date ?? '미상'}</td><td>{t.church ?? '본 교회'}</td></tr>{/each}
			</tbody></table>
		</div>
	{/if}
{:else if tab === '남전도회' || tab === '여전도회'}
	{@const names = tab === '남전도회' ? males : females}
	<div class="card">
		<div class="card-head"><h2>{tab} <span class="tag">{names.length}개</span></h2><span class="sub">교인 카드의 '전도회' 칸으로 모입니다</span></div>
		<div class="org-grid">
			{#each names as n}
				<button type="button" class="org-card" class:on={pickedSociety === n} onclick={() => (pickedSociety = n)}><b>{n}</b><span>{count(n)}명</span></button>
			{/each}
		</div>
	</div>
	{#if names.includes(pickedSociety)}
		<div class="card" style="padding:0;overflow-x:auto">
			<table class="sm"><thead><tr><th>{pickedSociety}</th><th>직분</th><th>나이</th><th>소그룹</th><th>휴대폰</th></tr></thead><tbody>
				{#each society(pickedSociety).map((p) => ({ p, s: registry.summary(p) })).sort((a, b) => a.p.name.localeCompare(b.p.name, 'ko')) as { p, s } (p.id)}
					<tr><td><a href="/{p.id}">{p.name}</a></td><td>{s.title || '-'}</td><td>{p.birth_date ? new Date().getFullYear() - +p.birth_date.slice(0, 4) : '-'}</td><td>{s.smallGroup || '-'}</td><td>{p.phone ?? '-'}</td></tr>
				{:else}<tr><td colspan="5" class="muted">회원이 없습니다.</td></tr>{/each}
			</tbody></table>
		</div>
	{/if}
{:else}
	<div class="org-head">
		<div><h2 style="margin:0">2026년도 교회 조직표</h2><span class="muted" style="font-size:.85rem">위원회 9개 · 부서 {units.filter((u) => u.parent_id).length}개 · 위원장 · 부서장 · 담당자는 '관리자 › 설정'에서 바꿉니다</span></div>
		{#if registry.perms.export}<a class="btn ghost" href="/documents?doc=교회 조직표">조직표 출력</a>{/if}
	</div>

	<div class="card" style="padding:0;overflow-x:auto">
		<table class="sm meet">
			<thead><tr><th>회의</th><th>의장</th><th>서기</th></tr></thead>
			<tbody>{#each registry.d.meetings as m (m.meeting)}<tr><td><b>{m.meeting}</b></td><td>{m.chair}</td><td>{m.secretary}</td></tr>{/each}</tbody>
		</table>
	</div>

	<div class="org-grid2">
		{#each committees as c, ci (c.id)}
			<section class="card committee">
				<div class="cm-head">
					<span class="num">{ci + 1}</span>
					<div><h3>{c.name}</h3><small>위원장 {#if c.leader_id}<a href="/{c.leader_id}">{nameOf(c.leader_id)}</a> 장로{:else}<span class="muted">미정</span>{/if}</small></div>
				</div>
				<table class="sm">
					<thead><tr><th>부서</th><th>부서장</th><th>담당자</th><th style="text-align:right">봉사</th></tr></thead>
					<tbody>
						{#each units.filter((u) => u.parent_id === c.id).sort((a, b) => a.sort_order - b.sort_order) as d, di (d.id)}
							<tr class="pick" class:on={pickedOrg === d.name} onclick={() => (pickedOrg = pickedOrg === d.name ? '' : d.name)}>
								<td><span class="muted">{ci + 1}-{di + 1}</span> <b>{d.name}</b></td>
								<td>{#if d.leader_id}<a href="/{d.leader_id}" onclick={(e) => e.stopPropagation()}>{nameOf(d.leader_id)}</a>{:else}<span class="muted">-</span>{/if}</td>
								<td>{#each d.staff_ids as sid, k (sid)}{k ? ', ' : ''}<a href="/{sid}" onclick={(e) => e.stopPropagation()}>{nameOf(sid)}</a>{:else}<span class="muted">-</span>{/each}</td>
								<td style="text-align:right">{deptMembers(d.name).length}명</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</section>
		{/each}
	</div>

	{#if pickedOrg}
		<div class="card">
			<h2>{pickedOrg} 봉사자</h2>
			<table class="sm"><thead><tr><th>이름</th><th>역할</th><th>시작</th></tr></thead><tbody>
				{#each deptMembers(pickedOrg) as a (a.id)}<tr><td><a href="/{a.person_id}">{nameOf(a.person_id)}</a></td><td>{a.role ?? '-'}</td><td>{a.start_date ?? '미상'}</td></tr>
				{:else}<tr><td colspan="3" class="muted">봉사자가 없습니다.</td></tr>{/each}
			</tbody></table>
		</div>
	{/if}
{/if}

<style>
	.org-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 0.8rem; flex-wrap: wrap; margin-bottom: 0.9rem; }
	.meet td, .meet th { text-align: center; }
	.org-grid2 { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 1rem; align-items: start; }
	.org-grid2 .card { margin: 0; padding: 0; }
	.cm-head { display: flex; align-items: center; gap: 0.7rem; padding: 0.85rem 1rem; background: linear-gradient(120deg, #2a50c8, #4a78f5); color: #fff; }
	.cm-head h3 { margin: 0; font-size: 1.02rem; }
	.cm-head small { opacity: 0.92; font-size: 0.82rem; }
	.cm-head a { color: #fff; text-decoration: underline; text-underline-offset: 2px; }
	.cm-head .num { flex: none; width: 1.8rem; height: 1.8rem; border-radius: 50%; display: grid; place-items: center; font-weight: 800; background: rgba(255, 255, 255, 0.22); }
	.committee td { white-space: nowrap; }
</style>
