<script lang="ts">
	// 관리자 › 설정: 교인구분 · 소그룹 편성 · 교회 조직표(회의 의장·서기 포함) · 코드표
	import { registry } from '#lib/registry/store.svelte.ts';
	import PersonPicker from '#lib/components/PersonPicker.svelte';
	import NameChips from '#lib/components/NameChips.svelte';
	import { CLERGY_TITLES, FULL_TIME_CLERGY, MAX_CATEGORY_DEPTH, MISSION_SOCIETIES, OFFICE_STATUS_OPTIONS, VISIT_KINDS } from '#lib/registry/types.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';

	const tabs = ['교인구분', '소그룹 편성', '교회 조직표', '코드표'];
	let tab = $state('교인구분');
	let msg = $state('');
	let addFor = $state<string | null>(null);
	let addName = $state('');
	let orgName = $state('');
	let deptFor = $state('');
	let deptName = $state('');

	const roots = $derived(registry.childrenOf(null));
	function add(parent: string | null) {
		if (!registry.addCategory(parent, addName)) msg = `${MAX_CATEGORY_DEPTH}단계까지만 만들 수 있습니다.`;
		else msg = '';
		addName = ''; addFor = null;
	}
	function del(id: string) {
		msg = registry.deleteCategory(id) ? '' : '이 구분에 속한 교인이 있어 지울 수 없습니다. 먼저 다른 구분으로 옮겨 주세요.';
	}
	const committees = $derived(registry.d.orgUnits.filter((o) => !o.parent_id).sort((a, b) => a.sort_order - b.sort_order));
</script>

<h1>설정 <span class="tag">사이트 관리자</span></h1>
{#if !registry.perms.admin}
	<div class="warn">사이트 관리자 권한이 필요합니다. (최고관리자에게 사이트 관리자 권한을 받아야 합니다)</div>
{:else}
	<div class="tabs">{#each tabs as t}<button class:on={tab === t} onclick={() => { tab = t; msg = ''; }}>{t}</button>{/each}</div>
	{#if msg}<div class="warn">{msg}</div>{/if}

	{#if tab === '교인구분'}
		<div class="card">
			<h2>교인구분 <span class="tag">{MAX_CATEGORY_DEPTH}단계까지</span></h2>
			<p class="muted">교인 카드의 '교인구분'에 쓰는 분류입니다. 이름을 바꾸면 그 구분의 모든 교인에게 바로 적용됩니다. 교인이 있는 구분은 지울 수 없습니다.</p>
			{#snippet node(id: string, name: string, level: number)}
				{@const usage = registry.categoryUsage(id).count}
				<div class="cat-row" style="padding-left:{(level - 1) * 1.6}rem">
					<span class="lvl">{level}</span>
					<input value={name} onchange={(e) => registry.renameCategory(id, e.currentTarget.value)} aria-label="구분 이름" />
					<span class="muted" style="font-size:.8rem;white-space:nowrap">{usage}명</span>
					{#if level < MAX_CATEGORY_DEPTH}<button type="button" class="ghost sm" onclick={() => { addFor = addFor === id ? null : id; addName = ''; }}>+ 하위</button>{/if}
					<button type="button" class="ghost sm" onclick={() => del(id)} disabled={usage > 0}>삭제</button>
				</div>
				{#if addFor === id}
					<form class="cat-row" style="padding-left:{level * 1.6}rem" onsubmit={(e) => { e.preventDefault(); add(id); }}>
						<span class="lvl">{level + 1}</span><input bind:value={addName} placeholder="새 구분 이름" /><button type="submit" class="sm">추가</button>
					</form>
				{/if}
				{#each registry.childrenOf(id) as c (c.id)}{@render node(c.id, c.name, level + 1)}{/each}
			{/snippet}
			{#each roots as c (c.id)}{@render node(c.id, c.name, 1)}{/each}
			<form class="cat-row" style="margin-top:.8rem" onsubmit={(e) => { e.preventDefault(); add(null); }}>
				<span class="lvl">1</span><input bind:value={addName} placeholder="새 1단계 구분 이름" /><button type="submit" class="sm">1단계 추가</button>
			</form>
		</div>
	{:else if tab === '소그룹 편성'}
		<div class="card" style="padding:0;overflow-x:auto">
			<div class="card-head" style="padding:1.1rem 1.3rem 0"><h2>소그룹 편성 <span class="tag">출석부 자료</span></h2><span class="sub">인도자와 모임 장소를 바꿉니다. 소그룹 소속 교인은 출석부에서 옵니다.</span></div>
			<table class="sm">
				<thead><tr><th>공동체</th><th>소그룹</th><th style="min-width:240px">인도자</th><th>모임 장소</th></tr></thead>
				<tbody>
					{#each COMMUNITY_DEFS as c}
						{#each registry.d.smallGroups.filter((g) => g.community === c.name).sort((a, b) => a.sort_order - b.sort_order) as g (g.id)}
							<tr>
								<td>{c.name}</td><td><b>{g.name}</b>{#if g.care}<span class="tag part">자녀 돌봄</span>{/if}</td>
								<td><PersonPicker value={g.leader_id ?? ''} placeholder="인도자 검색" onpick={(id) => registry.updateGroup(g.id, { leader_id: id })} /></td>
								<td><input value={g.place ?? ''} onchange={(e) => registry.updateGroup(g.id, { place: e.currentTarget.value || null })} /></td>
							</tr>
						{/each}
					{/each}
				</tbody>
			</table>
		</div>
	{:else if tab === '교회 조직표'}
		<div class="card">
			<h2>회의 의장 · 서기</h2>
			<table class="sm"><thead><tr><th>회의</th><th>의장</th><th>서기</th></tr></thead><tbody>
				{#each registry.d.meetings as m (m.meeting)}
					<tr><td><b>{m.meeting}</b></td>
						<td><input value={m.chair} onchange={(e) => registry.setMeeting(m.meeting, 'chair', e.currentTarget.value)} placeholder="예: 정담임 목사" /></td>
						<td><input value={m.secretary} onchange={(e) => registry.setMeeting(m.meeting, 'secretary', e.currentTarget.value)} placeholder="예: 홍길동 장로" /></td></tr>
				{/each}
			</tbody></table>
		</div>
		<div class="card">
			<h2>교회 조직표 <span class="tag">위원회 / 부서</span></h2>
			<p class="muted">위원회마다 위원장(장로), 부서마다 부서장과 담당자(여러 명)를 정합니다. ▲▼로 순서를 바꿉니다. 교인 카드의 '교회봉사'에서 이 부서 목록을 고릅니다. 봉사자가 있는 부서는 지울 수 없습니다.</p>
			{#each committees as c, ci (c.id)}
				<div class="org-edit">
					<div class="cat-row">
						<span class="lvl">{ci + 1}</span><input value={c.name} onchange={(e) => registry.renameOrgUnit(c.id, e.currentTarget.value)} style="max-width:12rem" />
						<span class="muted" style="font-size:.8rem">위원장</span>
						<div style="width:14rem"><PersonPicker value={c.leader_id ?? ''} placeholder="장로 검색" onpick={(id) => registry.setOrgLeader(c.id, id)} /></div>
						<button type="button" class="ghost sm" onclick={() => registry.moveOrgUnit(c.id, -1)} aria-label="위로">▲</button>
						<button type="button" class="ghost sm" onclick={() => registry.moveOrgUnit(c.id, 1)} aria-label="아래로">▼</button>
						<button type="button" class="ghost sm" onclick={() => { if (!registry.deleteOrgUnit(c.id)) msg = '봉사자가 있는 부서가 있어 지울 수 없습니다.'; else msg = ''; }}>삭제</button>
					</div>
					<table class="sm" style="margin-top:.4rem">
						<thead><tr><th>부서</th><th style="min-width:13rem">부서장</th><th style="min-width:16rem">담당자 (이름을 쓰고 쉼표)</th><th>봉사</th><th></th></tr></thead>
						<tbody>
							{#each registry.d.orgUnits.filter((o) => o.parent_id === c.id).sort((a, b) => a.sort_order - b.sort_order) as d (d.id)}
								<tr>
									<td><input value={d.name} onchange={(e) => registry.renameOrgUnit(d.id, e.currentTarget.value)} style="min-width:9rem" /></td>
									<td><PersonPicker value={d.leader_id ?? ''} placeholder="부서장 검색" onpick={(id) => registry.setOrgLeader(d.id, id)} /></td>
									<td><NameChips chips={d.staff_ids.map((id) => ({ id, name: registry.person(id)?.name ?? '' }))} onchange={(cs) => registry.setOrgStaff(d.id, cs.filter((x) => x.id).map((x) => x.id!))} placeholder="담당자 이름," /></td>
									<td style="white-space:nowrap">{registry.d.affiliations.filter((a) => a.org === d.name && !a.end_date).length}명</td>
									<td style="white-space:nowrap">
										<button type="button" class="ghost sm" onclick={() => registry.moveOrgUnit(d.id, -1)} aria-label="위로">▲</button>
										<button type="button" class="ghost sm" onclick={() => registry.moveOrgUnit(d.id, 1)} aria-label="아래로">▼</button>
										<button type="button" class="ghost sm" onclick={() => { if (!registry.deleteOrgUnit(d.id)) msg = '봉사자가 있는 부서는 지울 수 없습니다.'; else msg = ''; }}>삭제</button>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/each}
			<form class="cat-row" style="margin-top:.8rem" onsubmit={(e) => { e.preventDefault(); registry.addOrgUnit(null, orgName); orgName = ''; }}>
				<span class="lvl">+</span><input bind:value={orgName} placeholder="새 위원회 이름" /><button type="submit" class="sm">위원회 추가</button>
			</form>
			<form class="cat-row" onsubmit={(e) => { e.preventDefault(); if (deptFor) registry.addOrgUnit(deptFor, deptName); deptName = ''; }}>
				<span class="lvl">+</span>
				<select bind:value={deptFor} style="max-width:12rem"><option value="">위원회 선택</option>{#each committees as c}<option value={c.id}>{c.name}</option>{/each}</select>
				<input bind:value={deptName} placeholder="새 부서 이름" /><button type="submit" class="sm" disabled={!deptFor}>부서 추가</button>
			</form>
		</div>
	{:else}
		<div class="dash-grid even">
			<section class="card">
				<h2>직분과 신분 <span class="tag">고정 코드표</span></h2>
				<table class="sm"><thead><tr><th>직분</th><th>고를 수 있는 신분</th></tr></thead><tbody>
					{#each Object.entries(OFFICE_STATUS_OPTIONS) as [o, st]}<tr><td><b>{o}</b></td><td>{st.join(' · ')}</td></tr>{/each}
				</tbody></table>
				<p class="muted" style="font-size:.82rem">임직일과 임직교회는 장로·시무집사·권사에게 적습니다. 표시되는 직분 이름은 신분에서 자동으로 만들어집니다 (예: 시무 → 권사, 은퇴 → 은퇴권사).</p>
			</section>
			<section class="card">
				<h2>교역자 직책</h2>
				<p>{CLERGY_TITLES.join(' · ')}</p>
				<p class="muted">심방 기록을 볼 수 있는 전임 교역자: <b style="color:var(--text)">{FULL_TIME_CLERGY.join(' · ')}</b> (교육전도사 제외)</p>
				<h2 style="margin-top:1.2rem">전도회</h2>
				<p class="muted" style="margin:0">{MISSION_SOCIETIES.join(' · ')}</p>
				<h2 style="margin-top:1.2rem">심방 구분 <span class="tag part">디모데 목록 기준</span></h2>
				<p class="muted" style="margin:0">{VISIT_KINDS.join(' · ')}</p>
			</section>
		</div>
	{/if}
{/if}

<style>
	.org-edit { padding: 0.8rem 0; border-bottom: 1px dashed var(--line-strong); overflow-x: auto; }
</style>
