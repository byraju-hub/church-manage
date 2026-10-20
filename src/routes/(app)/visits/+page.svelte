<script lang="ts">
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';
	import Calendar from '#lib/components/Calendar.svelte';
	import PersonPicker from '#lib/components/PersonPicker.svelte';
	import { FULL_TIME_CLERGY, VISIT_KINDS, type VisitMethod, type VisitState } from '#lib/registry/types.ts';

	const today = new Date().toISOString().slice(0, 10);
	let tab = $state<'list' | 'cal' | 'new'>('list');
	let q = $state('');
	let kind = $state('');
	let vstate = $state('');
	let pastor = $state('');
	let from = $state('');
	let to = $state('');

	const pastors = $derived([...new Set(registry.d.visits.map((v) => v.pastor))].sort((a, b) => a.localeCompare(b, 'ko')));
	const clergy = $derived(registry.d.people.filter((p) => p.clergy_title && FULL_TIME_CLERGY.includes(p.clergy_title)));
	const nameOf = (id: string) => registry.person(id)?.name ?? '';
	const rows = $derived(
		registry.d.visits
			.filter((v) => {
				const t = q.trim().toLowerCase();
				if (t && !`${nameOf(v.person_id)} ${v.content} ${v.scripture ?? ''} ${v.follow_up ?? ''} ${v.companions ?? ''}`.toLowerCase().includes(t)) return false;
				return (!kind || v.kind === kind) && (!vstate || v.state === vstate) && (!pastor || v.pastor === pastor) && (!from || v.visit_date >= from) && (!to || v.visit_date <= to);
			})
			.sort((a, b) => b.visit_date.localeCompare(a.visit_date))
	);

	// 등록 폼
	let f = $state({ person: page.url.searchParams.get('person') ?? '', date: today, state: '완료' as VisitState, kind: '일반', method: '방문' as VisitMethod, pastor: '', companions: '', scripture: '', hymn: '', content: '', follow: '' });
	const nn = (x: string) => (x.trim() === '' ? null : x.trim());
	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!f.person) return;
		registry.addVisit({ person_id: f.person, visit_date: f.date, state: f.state, kind: f.kind, method: f.method, pastor: f.pastor || clergy[0]?.name || '담당 교역자', companions: nn(f.companions), scripture: nn(f.scripture), hymn: nn(f.hymn), content: f.state === '계획' && !f.content.trim() ? '심방 예정' : f.content, follow_up: nn(f.follow) });
		f.person = ''; f.content = ''; f.follow = ''; f.scripture = ''; f.hymn = ''; f.companions = '';
		tab = 'list';
	}
	$effect(() => { if (page.url.searchParams.get('person')) tab = 'new'; });
</script>

<h1>심방</h1>
{#if !registry.perms.visit}
	<div class="warn">심방 권한이 꺼져 있어 볼 수 없습니다. 심방 기록은 전임 교역자까지만 볼 수 있습니다. (상단 '권한 시험'에서 '심방'을 켜 보세요)</div>
{:else}
	<div class="tabs">
		<button class:on={tab === 'list'} onclick={() => (tab = 'list')}>목록으로 검색</button>
		<button class:on={tab === 'cal'} onclick={() => (tab = 'cal')}>날짜별 (달력)</button>
		{#if registry.perms.edit}<button class:on={tab === 'new'} onclick={() => (tab = 'new')}>+ 심방 등록</button>{/if}
	</div>

	{#if tab === 'list'}
		<div class="card">
			<div class="toolbar"><input type="search" placeholder="교인 이름 · 내용 · 말씀 · 동행자 검색" bind:value={q} /></div>
			<div class="toolbar">
				<select bind:value={vstate}><option value="">계획·완료 전체</option><option>계획</option><option>완료</option></select>
				<select bind:value={kind}><option value="">심방 구분 전체</option>{#each VISIT_KINDS as k}<option>{k}</option>{/each}</select>
				<select bind:value={pastor}><option value="">담당 교역자 전체</option>{#each pastors as k}<option>{k}</option>{/each}</select>
				<span class="muted">날짜</span><input type="date" bind:value={from} /> ~ <input type="date" bind:value={to} />
			</div>
		</div>
		<div class="card" style="padding:0;overflow-x:auto">
			<table class="sm">
				<thead><tr><th>날짜</th><th>상태</th><th>구분</th><th>교인</th><th>담당</th><th>내용</th><th>후속 조치</th><th></th></tr></thead>
				<tbody>
					{#each rows.slice(0, 200) as v (v.id)}
						<tr>
							<td style="white-space:nowrap">{v.visit_date}</td>
							<td><span class="badge" class:inactive={v.state === '계획'}>{v.state}</span></td>
							<td>{v.kind} <span class="muted">· {v.method}</span></td>
							<td><a href="/{v.person_id}">{nameOf(v.person_id)}</a></td>
							<td>{v.pastor}{v.companions ? ` (동행 ${v.companions})` : ''}</td>
							<td style="min-width:220px">{v.content}{v.scripture ? ` · ${v.scripture}` : ''}{v.hymn ? ` · ${v.hymn}` : ''}</td>
							<td>{v.follow_up ?? '-'}</td>
							<td>{#if registry.perms.edit && v.state === '계획'}<button class="ghost sm" onclick={() => registry.completeVisit(v.id)}>완료 처리</button>{/if}</td>
						</tr>
					{:else}<tr><td colspan="8" class="muted">조건에 맞는 심방이 없습니다.</td></tr>{/each}
				</tbody>
			</table>
		</div>
		{#if rows.length > 200}<p class="muted">{rows.length}건 중 200건만 보여 줍니다. 조건을 좁혀 보세요.</p>{/if}
	{:else if tab === 'cal'}
		<div class="card"><Calendar only={['심방 계획']} doneVisits /></div>
		<p class="muted">달력에는 예정된 심방과 완료된 심방이 함께 표시됩니다. 대시보드 달력에는 '심방 계획'만 나옵니다.</p>
	{:else}
		<form class="card form" onsubmit={submit}>
			<h2 class="wide">심방 등록</h2>
			<label class="wide">교인 *<PersonPicker bind:value={f.person} placeholder="심방받을 교인 이름·전화 검색" /></label>
			<label>날짜 *<input type="date" required bind:value={f.date} /></label>
			<label>상태<select bind:value={f.state}><option>완료</option><option>계획</option></select></label>
			<label>구분<select bind:value={f.kind}>{#each VISIT_KINDS as k}<option>{k}</option>{/each}</select></label>
			<label>방법<select bind:value={f.method}><option>방문</option><option>전화</option></select></label>
			<label>담당 교역자<select bind:value={f.pastor}><option value="">(선택)</option>{#each clergy as c}<option>{c.name}</option>{/each}</select></label>
			<label>동행자<input bind:value={f.companions} /></label>
			<label>말씀<input bind:value={f.scripture} placeholder="시편 23편" /></label>
			<label>찬송<input bind:value={f.hymn} placeholder="찬 305장" /></label>
			<label class="wide">내용<textarea rows="3" bind:value={f.content} required={f.state === '완료'}></textarea></label>
			<label class="wide">후속 조치<input bind:value={f.follow} /></label>
			<div class="wide row"><button type="submit" disabled={!f.person}>등록</button><button type="button" class="ghost" onclick={() => (tab = 'list')}>취소</button></div>
		</form>
	{/if}
{/if}
