<script lang="ts">
	// 공동체 · 소그룹별 명단: 2026년 편성표 순서(뿌리 → 줄기 → 열매, 소그룹도 편성표 순서), 마지막에 미지정자.
	// 각 명단은 가나다순, 올해(1월 1일 ~ 지난 주일) 소그룹 모임 출석률로 색 구분 (80% 이상 / 50~79% / 50% 미만), 인도자는 파랑
	// 올해 등록한 사람은 등록일 이후 주일만 셈
	import { registry } from '#lib/registry/store.svelte.ts';
	import { recentSundays } from '#lib/registry/attendance.mock.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';

	const active = $derived(registry.d.people.map((p) => ({ p, s: registry.summary(p) })).filter(({ s }) => s.memberCert));
	const YEAR = new Date().getFullYear();
	const WEEKS = recentSundays(60).filter((d) => d.startsWith(`${YEAR}-`));
	const rateOf = (id: string, registered: string | null) => {
		const ws = WEEKS.map((d, i) => ({ d, back: WEEKS.length - 1 - i })).filter((w) => !registered || w.d >= registered);
		if (!ws.length) return 0;
		return Math.round((ws.filter((w) => registry.groupAttended(id, w.d, w.back)).length * 100) / ws.length);
	};
	const band = (r: number) => (r >= 80 ? 'hi' : r >= 50 ? 'mid' : 'lo');
	type Row = (typeof active)[number] & { rate: number };
	const leaders = $derived(new Set(registry.d.smallGroups.map((g) => g.leader_id).filter((x): x is string => !!x)));
	const byGroup = $derived.by(() => {
		const rows: Row[] = active.map((x) => ({ ...x, rate: rateOf(x.p.id, x.s.registered ?? null) }));
		const byName = (a: Row, b: Row) => a.p.name.localeCompare(b.p.name, 'ko');
		const out: { community: string; groups: { name: string; xs: Row[]; rate: number }[] }[] = [];
		const used = new Set<Row>();
		const grp = (name: string, xs: Row[]) => {
			xs.forEach((x) => used.add(x));
			return { name, xs: xs.sort(byName), rate: xs.length ? Math.round(xs.reduce((s, x) => s + x.rate, 0) / xs.length) : 0 };
		};
		for (const c of COMMUNITY_DEFS) {
			const groups = c.groups.map((g) => grp(g.name, rows.filter((x) => x.s.community === c.name && x.s.smallGroup === g.name))).filter((g) => g.xs.length);
			if (groups.length) out.push({ community: c.name, groups });
		}
		const rest = rows.filter((x) => !used.has(x));
		if (rest.length) out.push({ community: '미지정', groups: [grp('소그룹 미지정자', rest)] });
		return out;
	});

	// 드롭다운: 공동체 → 소그룹 (비우면 전체)
	let comm = $state('');
	let group = $state('');
	const groupOpts = $derived(byGroup.find((c) => c.community === comm)?.groups.map((g) => g.name) ?? []);
	$effect(() => { void comm; group = ''; });
	const shown = $derived(
		byGroup
			.filter((c) => !comm || c.community === comm)
			.map((c) => ({ ...c, groups: c.groups.filter((g) => !group || g.name === group) }))
	);
	const shownCount = $derived(shown.reduce((s, c) => s + c.groups.reduce((t, g) => t + g.xs.length, 0), 0));
</script>

<h1>공동체 · 소그룹별 명단</h1>
<div class="card pick">
	<select bind:value={comm} aria-label="공동체 선택"><option value="">전체 공동체</option>{#each byGroup as c}<option value={c.community}>{c.community}</option>{/each}</select>
	<select bind:value={group} disabled={!comm || comm === '미지정'} aria-label="소그룹 선택"><option value="">{comm ? '전체 소그룹' : '공동체를 먼저 고르세요'}</option>{#each groupOpts as g}<option value={g}>{g}</option>{/each}</select>
	<span class="muted">{shownCount}명</span>
</div>
<p class="legend-att muted">{YEAR}년 소그룹 모임 출석률 (1월 1일 ~ {WEEKS.at(-1)?.slice(5).replace('-', '/')}, 주일 {WEEKS.length}회) ·
	<span class="hi">● 80% 이상</span> <span class="mid">● 50~79%</span> <span class="lo">● 50% 미만</span> <span class="lead">● 인도자</span>
	<span>(이름 옆 숫자는 개인 출석률)</span></p>
{#each shown as c}
	<h2 style="margin:1.2rem 0 .5rem">{c.community}</h2>
	{#each c.groups as g}
		<div class="card"><h3 style="margin:0 0 .5rem">{g.name} <span class="muted">({g.xs.length}명)</span> <small class="{band(g.rate)}">평균 출석률 {g.rate}%</small></h3>
			<div class="names">
				{#each g.xs as { p, s, rate }}{@const lead = leaders.has(p.id)}<a href="/{p.id}" class="nm {lead ? 'lead' : band(rate)}" title="{lead ? '인도자 · ' : ''}올해 소그룹 모임 출석률 {rate}%">{p.name}{s.title ? ` ${s.title}` : ''}<small>{lead ? '인도자 · ' : ''}{rate}%</small></a>{/each}
			</div>
		</div>
	{/each}
{/each}

<style>
	/* 출석률 색: 80% 이상 초록 / 50~79% 연한 주황 / 50% 미만 연한 회색 (--c 바탕색, --t 글자색) */
	.hi { --c: #2f9e44; --t: #2f9e44; } .mid { --c: #ffa94d; --t: #fd7e14; } .lo { --c: #ced4da; --t: #9aa1a9; }
	.lead { --c: #1c7ed6; --t: #1c7ed6; } /* 인도자는 출석률과 상관없이 파랑 */
	small.hi, small.mid, small.lo, .legend-att span[class] { color: var(--t); font-weight: 700; }
	.pick { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem; }
	.pick select { width: auto; min-width: 11rem; }
	.legend-att { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; align-items: center; }
	.names { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.nm { display: inline-flex; align-items: baseline; gap: 0.25rem; padding: 0.2rem 0.55rem; border-radius: 8px; font-weight: 600; color: var(--t); background: color-mix(in srgb, var(--c) 12%, #fff); border: 1px solid color-mix(in srgb, var(--c) 40%, #fff); text-decoration: none; }
	.nm small { font-size: 0.72rem; font-weight: 500; opacity: 0.85; }
</style>
