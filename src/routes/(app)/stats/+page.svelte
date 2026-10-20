<script lang="ts">
	// 통계: 주일 출석(장년·교육부서) · 소그룹 출석 · 임직 · 세례
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';
	import { recentSundays } from '#lib/registry/attendance.mock.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';
	import { EDU_DEPTS, FAITH_KINDS, OFFICE_NAMES, OFFICE_STATUSES } from '#lib/registry/types.ts';

	const tabs = ['주일 출석', '소그룹 출석', '임직', '세례'];
	let tab = $state(page.url.searchParams.get('tab') ?? '주일 출석');
	const WEEKS = recentSundays(8);
	const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
	const members = $derived(registry.d.people.map((p) => ({ p, s: registry.summary(p) })).filter((x) => x.s.memberCert));

	// ---- 주일 출석: 장년 / 교육부서 ----
	const attend = (list: typeof members) => WEEKS.map((d, i) => list.filter(({ p }) => registry.attended(p.id, d, WEEKS.length - 1 - i)).length);
	const adult = $derived(members.filter((x) => x.s.cat2 === '장년' || (x.s.cat2 === '새가족' && !x.p.edu_dept)));
	const adultWeekly = $derived(attend(adult));
	const depts = $derived(EDU_DEPTS.map((d) => {
		const l = members.filter((x) => x.p.edu_dept === d);
		return { name: d, total: l.length, weekly: attend(l) };
	}));
	const maxAdult = $derived(Math.max(1, ...adultWeekly));
	const pct = (n: number, t: number) => (t ? Math.round((n * 100) / t) : 0);

	// ---- 소그룹 출석 ----
	let comm = $state('전체');
	const groupRows = $derived(
		registry.d.smallGroups.filter((g) => comm === '전체' || g.community === comm).sort((a, b) => a.community.localeCompare(b.community, 'ko') || a.sort_order - b.sort_order).map((g) => {
			const l = members.filter((x) => x.s.smallGroup === g.name);
			const weekly = attend(l);
			const avg4 = l.length ? Math.round((weekly.slice(-4).reduce((a, b) => a + b, 0) * 100) / (l.length * 4)) : 0;
			return { g, total: l.length, weekly, avg4 };
		})
	);
	const heat = (v: number) => `color-mix(in srgb, var(--primary) ${Math.round(v * 0.62)}%, #fff)`;

	// ---- 임직 ----
	const live = $derived(registry.d.officeTerms.filter((t) => !t.end_date && t.rank_status !== '사임'));
	const matrix = (office: string, st: string) => live.filter((t) => t.office === office && t.rank_status === st && registry.person(t.person_id)).length;
	const years = Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i);
	const ordYear = (office: string, y: number) => registry.d.officeTerms.filter((t) => t.office === office && t.start_date?.startsWith(String(y)) && t.rank_status !== '은퇴' && t.rank_status !== '원로').length;
	const ordOffices = ['장로', '시무집사', '권사', '서리집사'];

	// ---- 세례 ----
	const faithYear = (kind: string, y: number) => registry.d.faithEvents.filter((f) => f.kind === kind && f.event_date?.startsWith(String(y))).length;
	const faithNow = $derived.by(() => {
		const m: Record<string, number> = {};
		for (const x of members) m[x.s.faith] = (m[x.s.faith] ?? 0) + 1;
		return m;
	});
</script>

<h1>통계</h1>
<div class="tabs">{#each tabs as t}<button class:on={tab === t} onclick={() => (tab = t)}>{t}</button>{/each}</div>

{#if tab === '주일 출석'}
	<div class="dash-grid even">
		<section class="card">
			<div class="card-head"><div><h2>장년 주일 출석</h2><span class="sub">최근 8주 · 재적 장년·새가족 {adult.length}명</span></div></div>
			<div class="spark">
				{#each adultWeekly as n, i}<div class="col"><span>{n}</span><i style="height:{(n * 100) / maxAdult}%"></i><small>{md(WEEKS[i])}</small></div>{/each}
			</div>
		</section>
		<section class="card">
			<div class="card-head" id="edu"><div><h2>교육부서 이번 주일 출석률</h2><span class="sub">교육부서 보고서와 이어 붙일 자리 (지금은 가상 샘플)</span></div></div>
			{#each depts as d}
				<div class="hbar"><span class="nm">{d.name}</span><div class="track"><i style="width:{pct(d.weekly[7], d.total)}%"></i></div><span class="v">{d.weekly[7]}/{d.total}명</span></div>
			{/each}
		</section>
	</div>
	<div class="card" style="padding:0;overflow-x:auto">
		<table class="sm">
			<thead><tr><th>구분</th><th>재적</th>{#each WEEKS as d}<th style="text-align:right">{md(d)}</th>{/each}</tr></thead>
			<tbody>
				<tr><td><b>장년</b></td><td>{adult.length}</td>{#each adultWeekly as n}<td style="text-align:right">{n}</td>{/each}</tr>
				{#each depts as d}<tr><td>{d.name}</td><td>{d.total}</td>{#each d.weekly as n}<td style="text-align:right">{n}</td>{/each}</tr>{/each}
			</tbody>
		</table>
	</div>
{:else if tab === '소그룹 출석'}
	<div class="card">
		<div class="toolbar">
			<select bind:value={comm}><option>전체</option>{#each COMMUNITY_DEFS as c}<option>{c.name}</option>{/each}</select>
			<span class="muted">칸의 색이 진할수록 출석률이 높습니다. 소그룹 이름을 누르면 상세 화면으로 갑니다.</span>
		</div>
	</div>
	<div class="card" style="padding:0;overflow-x:auto">
		<table class="sm">
			<thead><tr><th>공동체</th><th>소그룹</th><th>인원</th>{#each WEEKS as d}<th style="text-align:center">{md(d)}</th>{/each}<th>4주 평균</th></tr></thead>
			<tbody>
				{#each groupRows as r (r.g.id)}
					<tr>
						<td>{r.g.community}</td>
						<td><a href="/communities/{encodeURIComponent(r.g.name)}"><b>{r.g.name}</b></a></td>
						<td>{r.total}</td>
						{#each r.weekly as n}{@const v = pct(n, r.total)}<td style="text-align:center;background:{heat(v)};color:{v > 65 ? '#fff' : 'inherit'}">{v}%</td>{/each}
						<td><b>{r.avg4}%</b></td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else if tab === '임직'}
	<div class="card" style="padding:0;overflow-x:auto">
		<div class="card-head" style="padding:1.1rem 1.3rem 0"><h2>임직자 현황 <span class="tag">지금 기준</span></h2><span class="sub">직분 × 신분</span></div>
		<table class="sm">
			<thead><tr><th>직분</th>{#each OFFICE_STATUSES as s}<th style="text-align:right">{s}</th>{/each}<th style="text-align:right">합계</th></tr></thead>
			<tbody>
				{#each OFFICE_NAMES as o}
					{@const total = OFFICE_STATUSES.reduce((a, s) => a + matrix(o, s), 0)}
					<tr><td><b>{o}</b></td>{#each OFFICE_STATUSES as s}<td style="text-align:right" class:muted={!matrix(o, s)}>{matrix(o, s) || '-'}</td>{/each}<td style="text-align:right"><b>{total}</b></td></tr>
				{/each}
			</tbody>
		</table>
	</div>
	<div class="card" style="padding:0;overflow-x:auto">
		<div class="card-head" style="padding:1.1rem 1.3rem 0"><h2>연도별 임직</h2><span class="sub">임직일(시작일) 기준 · 최근 10년</span></div>
		<table class="sm">
			<thead><tr><th>연도</th>{#each ordOffices as o}<th style="text-align:right">{o}</th>{/each}</tr></thead>
			<tbody>{#each years as y}<tr><td>{y}</td>{#each ordOffices as o}<td style="text-align:right" class:muted={!ordYear(o, y)}>{ordYear(o, y) || '-'}</td>{/each}</tr>{/each}</tbody>
		</table>
	</div>
{:else}
	<div class="dash-grid even">
		<section class="card">
			<div class="card-head"><h2>재적 교인 신급 현황</h2></div>
			{#each ['세례교인', '유아세례교인', '학습교인', '원입교인', '미확인'] as k}
				<div class="hbar"><span class="nm">{k}</span><div class="track"><i style="width:{pct(faithNow[k] ?? 0, members.length)}%"></i></div><span class="v">{faithNow[k] ?? 0}명</span></div>
			{/each}
			<p class="muted" style="font-size:.82rem">'미확인'은 신급 기록이 아직 없는 사람입니다. 확인이 끝나야 교세 통계가 정확해집니다.</p>
		</section>
		<section class="card" style="padding:0;overflow-x:auto">
			<div class="card-head" style="padding:1.1rem 1.3rem 0"><h2>연도별 신급 기록</h2><span class="sub">최근 10년</span></div>
			<table class="sm">
				<thead><tr><th>연도</th>{#each FAITH_KINDS as k}<th style="text-align:right">{k}</th>{/each}</tr></thead>
				<tbody>{#each years as y}<tr><td>{y}</td>{#each FAITH_KINDS as k}<td style="text-align:right" class:muted={!faithYear(k, y)}>{faithYear(k, y) || '-'}</td>{/each}</tr>{/each}</tbody>
			</table>
		</section>
	</div>
{/if}
