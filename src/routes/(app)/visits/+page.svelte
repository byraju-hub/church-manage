<script lang="ts">
	// 심방: 목록 검색 · 달력 · 등록 (심방 권한이 있는 회원만)
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';
	import Calendar from '#lib/components/Calendar.svelte';
	import PersonPicker from '#lib/components/PersonPicker.svelte';
	import NameChips, { type Chip } from '#lib/components/NameChips.svelte';
	import VisitAnalyzer, { type Analysis } from '#lib/components/VisitAnalyzer.svelte';
	import { FULL_TIME_CLERGY, VISIT_KINDS, type VisitMethod } from '#lib/registry/types.ts';

	const today = new Date().toISOString().slice(0, 10);
	let tab = $state<'list' | 'cal' | 'new'>('list');
	let q = $state(page.url.searchParams.get('q') ?? '');
	let kind = $state('');
	let pastor = $state('');
	let from = $state(page.url.searchParams.get('from') ?? '');
	let to = $state('');

	const pastors = $derived([...new Set(registry.d.visits.map((v) => v.pastor))].sort((a, b) => a.localeCompare(b, 'ko')));
	const clergy = $derived(registry.d.people.filter((p) => p.clergy_title && FULL_TIME_CLERGY.includes(p.clergy_title)));
	const nameOf = (id: string) => registry.person(id)?.name ?? '';
	const rows = $derived(
		registry.d.visits
			.filter((v) => {
				const t = q.trim().toLowerCase();
				if (t && !`${nameOf(v.person_id)} ${v.content} ${v.scripture ?? ''} ${v.follow_up ?? ''} ${v.companions ?? ''}`.toLowerCase().includes(t)) return false;
				return (!kind || v.kind === kind) && (!pastor || v.pastor === pastor) && (!from || v.visit_date >= from) && (!to || v.visit_date <= to);
			})
			.sort((a, b) => b.visit_date.localeCompare(a.visit_date))
	);

	// 등록 폼
	let f = $state({ person: page.url.searchParams.get('person') ?? '', date: page.url.searchParams.get('date') ?? today, kind: page.url.searchParams.get('kind') ?? '일반', method: '대면' as VisitMethod, pastor: '', scripture: '', hymn: '', content: '', follow: '' });
	let companions = $state<Chip[]>([]);
	const nn = (x: string) => (x.trim() === '' ? null : x.trim());
	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (!f.person) return;
		registry.addVisit({ person_id: f.person, visit_date: f.date, kind: f.kind, method: f.method, pastor: f.pastor || clergy[0]?.name || '담당 교역자', companions: companions.length ? companions.map((c) => c.name).join(', ') : null, scripture: nn(f.scripture), hymn: nn(f.hymn), content: f.content, follow_up: nn(f.follow) });
		f.person = ''; f.content = ''; f.follow = ''; f.scripture = ''; f.hymn = ''; companions = [];
		tab = 'list';
	}
	$effect(() => { if (page.url.searchParams.get('person')) tab = 'new'; });

	// 녹음·문서 분석 결과를 입력 칸에 채움
	function applyAnalysis(r: Analysis) {
		if (r.kind) f.kind = r.kind;
		if (r.content) f.content = r.content;
		if (r.scripture) f.scripture = r.scripture;
		if (r.hymn) f.hymn = r.hymn;
		if (r.follow_up) f.follow = r.follow_up;
		if (r.companions?.length) companions = r.companions.map((n) => { const m = registry.d.people.filter((p) => p.name === n); return { id: m.length === 1 ? m[0].id : null, name: n }; });
	}
</script>

<h1>심방</h1>
{#if !registry.perms.visit}
	<div class="warn">심방 권한이 꺼져 있어 볼 수 없습니다. 심방 기록은 전임 교역자까지만 볼 수 있습니다. (최고관리자가 '관리자 › 사용자 · 권한'에서 심방 권한을 준 사용자만 볼 수 있습니다)</div>
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
				<select bind:value={kind}><option value="">심방 구분 전체</option>{#each VISIT_KINDS as k}<option>{k}</option>{/each}</select>
				<select bind:value={pastor}><option value="">담당 교역자 전체</option>{#each pastors as k}<option>{k}</option>{/each}</select>
				<span class="muted">날짜</span><input type="date" bind:value={from} /> ~ <input type="date" bind:value={to} />
			</div>
		</div>
		<div class="card" style="padding:0;overflow-x:auto">
			<table class="sm">
				<thead><tr><th>날짜</th><th>구분</th><th>교인</th><th>담당</th><th>내용</th><th>후속 조치</th></tr></thead>
				<tbody>
					{#each rows.slice(0, 200) as v (v.id)}
						<tr>
							<td style="white-space:nowrap">{v.visit_date}</td>
							<td>{v.kind} <span class="muted">· {v.method}</span></td>
							<td><a href="/{v.person_id}">{nameOf(v.person_id)}</a></td>
							<td>{v.pastor}{v.companions ? ` (동행 ${v.companions})` : ''}</td>
							<td style="min-width:220px">{v.content}{v.scripture ? ` · ${v.scripture}` : ''}{v.hymn ? ` · ${v.hymn}` : ''}</td>
							<td>{v.follow_up ?? '-'}</td>
						</tr>
					{:else}<tr><td colspan="7" class="muted">조건에 맞는 심방이 없습니다.</td></tr>{/each}
				</tbody>
			</table>
		</div>
		{#if rows.length > 200}<p class="muted">{rows.length}건 중 200건만 보여 줍니다. 조건을 좁혀 보세요.</p>{/if}
	{:else if tab === 'cal'}
		<div class="card"><Calendar only={['심방 계획']} /></div>
		<p class="muted">달력에는 등록된 심방이 날짜별로 표시됩니다. 앞으로의 날짜로 등록하면 심방 계획으로 보입니다.</p>
	{:else}
		<form class="card form" onsubmit={submit}>
			<h2 class="wide">심방 등록</h2>
			<label class="wide">교인 *<PersonPicker bind:value={f.person} placeholder="심방받을 교인 이름·전화 검색" /></label>
			<label>날짜 *<input type="date" required bind:value={f.date} /></label>
						<label>구분<select bind:value={f.kind}>{#each VISIT_KINDS as k}<option>{k}</option>{/each}</select></label>
			<label>방법<select bind:value={f.method}><option>대면</option><option>전화</option></select></label>
			<label>담당 교역자<select bind:value={f.pastor}><option value="">(선택)</option>{#each clergy as c}<option>{c.name}</option>{/each}</select></label>
			<label class="wide">동행자 <span class="muted" style="font-weight:400">(이름을 쓰고 쉼표 · 같은 이름이 여러 명이면 목록에서 선택)</span><NameChips bind:chips={companions} allowFree placeholder="예: 김영수, 이순희" /></label>
			<div class="wide"><VisitAnalyzer onresult={applyAnalysis} /></div>
			<label>말씀<input bind:value={f.scripture} placeholder="시편 23편" /></label>
			<label>찬송<input bind:value={f.hymn} placeholder="찬 305장" /></label>
			<label class="wide">심방 내용<textarea rows="5" bind:value={f.content} required></textarea></label>
			<label class="wide">후속 조치<input bind:value={f.follow} /></label>
			<div class="wide row"><button type="submit" disabled={!f.person}>등록</button><button type="button" class="ghost" onclick={() => (tab = 'list')}>취소</button></div>
		</form>
	{/if}
{/if}
