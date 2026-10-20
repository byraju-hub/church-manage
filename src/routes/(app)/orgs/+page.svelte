<script lang="ts">
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
		<div class="card-head"><h2>{tab} <span class="tag">{office} 시무 {list.length}명</span></h2><span class="sub">{office} 직분의 시무 중인 사람이 자동으로 모입니다</span></div>
		<div class="org-grid">
			{#each list as { t, p } (t.id)}
				<a class="org-card" href="/{p.id}" style="text-decoration:none"><b>{p.name} {office === '시무집사' ? '집사' : office}</b><span>임직 {t.start_date ?? '미상'}{t.church ? ` · ${t.church}` : ''}</span></a>
			{:else}<p class="empty">해당자가 없습니다.</p>{/each}
		</div>
	</div>
	{@const rest = others(office)}
	{#if rest.length}
		<div class="card">
			<h2>그 밖의 신분 <span class="muted" style="font-weight:400">(은퇴 · 원로 · 명예 · 협동 · 전입)</span></h2>
			<table class="sm"><thead><tr><th>이름</th><th>신분</th><th>시작</th><th>임직교회</th></tr></thead><tbody>
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
	<div class="card">
		<div class="card-head"><h2>교회 조직표 <span class="tag">위원회 / 부서</span></h2><span class="sub">이름과 구성은 '관리자 › 설정'에서 바꿉니다 · 부서를 누르면 봉사자 명단</span></div>
		{#each committees as c (c.id)}
			<div style="margin-bottom:1.1rem">
				<h3 style="margin:.2rem 0 .5rem;font-size:1rem">{c.name}{#if c.leader_id}<span class="tag now">위원장 <a href="/{c.leader_id}">{nameOf(c.leader_id)}</a> 장로</span>{/if}</h3>
				<div class="org-grid">
					{#each units.filter((u) => u.parent_id === c.id).sort((a, b) => a.sort_order - b.sort_order) as d (d.id)}
						<button type="button" class="org-card" class:on={pickedOrg === d.name} onclick={() => (pickedOrg = d.name)}><b>{d.name}</b><span>{d.leader_id ? `담당 ${nameOf(d.leader_id)} · ` : ''}{deptMembers(d.name).length}명</span></button>
					{/each}
				</div>
			</div>
		{/each}
	</div>
	<div class="card"><h2>회의 의장 · 서기</h2><p class="muted" style="margin:0">공동의회·당회 의장은 담임목사, 제직회 서기는 집사가 맡습니다. (서기 지정은 관리자 설정 후보)</p></div>
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
