<script lang="ts">
	// 소그룹별 명단: 2026년 편성표 순서(뿌리 → 줄기 → 열매, 소그룹도 편성표 순서), 마지막에 미지정자.
	// 각 명단은 가나다순, 올해(1월 1일 ~ 지난 주일) 소그룹 모임 출석률로 색 구분 (80% 이상 / 50~79% / 50% 미만), 인도자는 파랑
	// 올해 등록한 사람은 등록일 이후 주일만 셈
	import { registry } from '#lib/registry/store.svelte.ts';
	import { recentSundays } from '#lib/registry/attendance.mock.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';
	import { ageOf } from '#lib/registry/derive.ts';
	import { tick } from 'svelte';

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
			const groups = registry.groupsIn(c.name).map((g) => grp(g.name, rows.filter((x) => x.s.community === c.name && x.s.smallGroup === g.name))).filter((g) => g.xs.length);
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

	// ---- 출력 · PDF: 지금 고른 공동체·소그룹만, 출석률 색 없이 가나다순 표로 ----
	const today = new Date().toISOString().slice(0, 10);
	const leaderOf = (name: string) => { const id = registry.groupDef(name)?.leader_id; return id ? registry.person(id)?.name ?? '' : ''; };
	const scope = $derived(group ? `${comm} › ${group}` : comm || '전체 공동체');
	const fileName = $derived(`소그룹별 명단-${(group || comm || '전체').replace(/\s+/g, '')}-${today}.pdf`);
	let sheet = $state<HTMLElement>();
	let busy = $state(false);

	// 인쇄·PDF 항목 고르기: 이름(필수)·직분만이면 소그룹마다 이름 상자, 그 밖의 항목이 하나라도 있으면 표
	const COLS = ['이름', '직분', '생년월일', '나이', '휴대폰', '비고'] as const;
	type Col = (typeof COLS)[number];
	let cols = $state<Record<Col, boolean>>({ 이름: true, 직분: true, 생년월일: false, 나이: false, 휴대폰: false, 비고: false });
	const tableMode = $derived(cols.생년월일 || cols.나이 || cols.휴대폰 || cols.비고);
	const tableCols = $derived(COLS.filter((c) => cols[c]));
	// 표 칸 너비: 고른 항목들의 비율로 나눠 이름 칸만 길어지지 않게 (글자 수 기준 비율)
	const WEIGHT: Record<string, number> = { 번호: 0.7, 이름: 1.5, 직분: 1.4, 생년월일: 1.8, 나이: 0.8, 휴대폰: 1.9, 비고: 1.2 };
	const colPct = (c: string) => Math.round((WEIGHT[c] * 1000) / (WEIGHT.번호 + tableCols.reduce((s, x) => s + WEIGHT[x], 0))) / 10;
	let ask = $state<null | '인쇄' | 'PDF 저장' | '엑셀'>(null);
	const cell = (c: Col, p: Row['p'], s: Row['s']) =>
		c === '이름' ? `${p.name}${p.name_note ? ` (${p.name_note})` : ''}`
		: c === '직분' ? s.title || ''
		: c === '생년월일' ? (p.birth_date ? `${p.birth_date.replaceAll('-', '.')}${p.birth_lunar ? ' (음)' : ''}` : '')
		: c === '나이' ? (ageOf(p.birth_date) ?? '') + ''
		: c === '휴대폰' ? p.phone ?? ''
		: leaders.has(p.id) ? '인도자' : '';
	async function go() {
		const what = ask;
		ask = null;
		await tick();
		if (what === '인쇄') { registry.log('출력', `소그룹별 명단 인쇄 · ${scope} · ${tableCols.join('·')}`); window.print(); }
		else if (what === 'PDF 저장') await pdf();
		else if (what === '엑셀') await excel();
	}
	// 엑셀(.xlsx): 고른 항목을 한 줄에 한 사람씩. 앞에 공동체·소그룹·번호, 소그룹 안은 가나다순
	async function excel() {
		busy = true;
		try {
			const writeXlsxFile = (await import('write-excel-file/browser')).default;
			// 모든 칸 가운데 정렬 + 얇은 테두리
			const border = { borderStyle: 'thin' as const, borderColor: '#999999', align: 'center' as const, alignVertical: 'center' as const };
			const heads = ['공동체', '소그룹', '번호', ...tableCols];
			const data = [
				heads.map((h) => ({ value: h, fontWeight: 'bold' as const, backgroundColor: '#E9ECEF', ...border })),
				...shown.flatMap((c) => c.groups.flatMap((g) => g.xs.map(({ p, s }, i) => [
					{ value: c.community, ...border },
					{ value: g.name, ...border },
					{ value: i + 1, type: Number, ...border },
					...tableCols.map((col) => ({ value: cell(col, p, s), ...border }))
				])))
			];
			const W: Record<string, number> = { 공동체: 12, 소그룹: 12, 번호: 6, 이름: 12, 직분: 11, 생년월일: 15, 나이: 6, 휴대폰: 15, 비고: 10 };
			await writeXlsxFile(data, { sheet: '소그룹별 명단', columns: heads.map((h) => ({ width: W[h] ?? 12 })), stickyRowsCount: 1 }).toFile(fileName.replace(/\.pdf$/, '.xlsx'));
			registry.log('내려받기', `소그룹별 명단 엑셀 · ${scope} · ${tableCols.join('·')}`);
		} finally {
			busy = false;
		}
	}
	async function pdf() {
		if (!sheet) return;
		busy = true;
		try {
			const html2pdf = (await import('html2pdf.js')).default;
			// 문서처럼 보이도록 상하좌우 여백을 넉넉히 (mm: 위, 왼쪽, 아래, 오른쪽)
			const opts = { margin: [20, 18, 20, 18], filename: fileName, image: { type: 'jpeg', quality: 0.96 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.grp-head', '.keep'] } };
			await html2pdf().set(opts as unknown as Record<string, never>).from(sheet).save();
			registry.log('출력', `소그룹별 명단 PDF · ${scope} · ${tableCols.join('·')}`);
		} finally {
			busy = false;
		}
	}
</script>

<div class="no-print">
<h1>소그룹별 명단</h1>
<div class="card pick">
	<select bind:value={comm} aria-label="공동체 선택"><option value="">전체 공동체</option>{#each byGroup as c}<option value={c.community}>{c.community}</option>{/each}</select>
	<select bind:value={group} disabled={!comm || comm === '미지정'} aria-label="소그룹 선택"><option value="">{comm ? '전체 소그룹' : '공동체를 먼저 고르세요'}</option>{#each groupOpts as g}<option value={g}>{g}</option>{/each}</select>
	<span class="muted">{shownCount}명</span>
	<span class="out">
		<button type="button" class="ghost" onclick={() => (ask = '인쇄')} disabled={!registry.perms.export || !shownCount} title={registry.perms.export ? '지금 고른 명단을 인쇄' : '내려받기·출력 권한이 필요합니다'}>인쇄</button>
		<button type="button" class="ghost xl" onclick={() => (ask = '엑셀')} disabled={!registry.perms.export || !shownCount || busy} title="엑셀(.xlsx)로 내보내기" aria-label="엑셀로 내보내기">
			<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="3" width="20" height="18" rx="3" fill="#1D6F42" /><path d="M7.5 7.5l4 4.5-4 4.5M16.5 7.5l-4 4.5 4 4.5" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
			엑셀
		</button>
		<button type="button" class="ghost pdf" onclick={() => (ask = 'PDF 저장')} disabled={!registry.perms.export || !shownCount || busy} title="PDF로 저장" aria-label="PDF로 저장">
			<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="2" width="20" height="20" rx="4" fill="#E2231A" /><path d="M6.2 17.3c1.2-.7 3.6-4.7 5.1-9.4.4-1.3.1-2.3-.5-2.3s-.9 1-.5 2.6c.8 3 3.6 6.8 6.4 7.6 1.6.5 2.2-.2 1.6-.8-.7-.7-3.9-.4-7 .7-3 1.1-5.1 2.7-5.1 1.6z" fill="none" stroke="#fff" stroke-width="1.4" stroke-linejoin="round" /></svg>
			{busy ? '만드는 중…' : 'PDF'}
		</button>
	</span>
</div>
{#if ask}
	<!-- 인쇄·PDF에 넣을 항목 고르기 -->
	<div class="dlg-back" role="presentation" onclick={() => (ask = null)}></div>
	<div class="dlg card" role="dialog" aria-modal="true" aria-label="{ask} 항목 선택">
		<h3 style="margin:0 0 .3rem">{ask} — 넣을 항목</h3>
		<p class="muted" style="margin:0 0 .8rem;font-size:.84rem">{scope} · {shownCount}명</p>
		<div class="cols">
			{#each COLS as c}
				<label class="chk"><input type="checkbox" bind:checked={cols[c]} disabled={c === '이름'} />{c}</label>
			{/each}
		</div>
		<p class="muted" style="font-size:.8rem;margin:.8rem 0 1rem">
			{#if ask === '엑셀'}엑셀 파일(.xlsx)로 내보냅니다: 공동체 · 소그룹 · 번호 · {tableCols.join(' · ')}{:else if tableMode}표로 만듭니다: 번호 · {tableCols.join(' · ')}{:else}소그룹마다 상자 안에 이름{cols.직분 ? '·직분' : ''}을 가나다순으로 나열합니다.{/if}
		</p>
		<div class="row" style="justify-content:flex-end">
			<button type="button" class="ghost" onclick={() => (ask = null)}>취소</button>
			<button type="button" onclick={go}>{ask === '엑셀' ? '엑셀로 내보내기' : ask}</button>
		</div>
	</div>
{/if}
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
</div>

<!-- 출력·PDF용 명단: 화면에는 보이지 않고, 출력·PDF 저장 때만 씀. 색 구분 없이 가나다순 표 -->
<div class="print-wrap">
	<div class="sheet" bind:this={sheet}>
		<div class="sh-title">
			<h1>소그룹별 명단</h1>
			<p>{scope} · {shownCount}명 · {today} 기준</p>
		</div>
		{#each shown as c}
			{#each c.groups as g}
				{@const lead = leaderOf(g.name)}
				{#if tableMode}
					<div class="grp-head">{c.community === '미지정' ? '' : `${c.community} › `}<b>{g.name}</b> ({g.xs.length}명){#if lead}<span>인도자 {lead}</span>{/if}</div>
					<table class="rt">
						<colgroup><col style="width:{colPct('번호')}%" />{#each tableCols as c}<col style="width:{colPct(c)}%" />{/each}</colgroup>
						<thead><tr><th>번호</th>{#each tableCols as c}<th>{c}</th>{/each}</tr></thead>
						<tbody>
							{#each g.xs as { p, s }, i}
								<tr><td class="c">{i + 1}</td>{#each tableCols as c}<td class:c={c === '나이'}>{cell(c, p, s)}</td>{/each}</tr>
							{/each}
						</tbody>
					</table>
				{:else}
					<!-- 소그룹 제목과 이름 상자가 페이지 사이에서 떨어지지 않도록 한 덩어리로 -->
					<div class="keep">
						<div class="grp-head">{c.community === '미지정' ? '' : `${c.community} › `}<b>{g.name}</b> ({g.xs.length}명){#if lead}<span>인도자 {lead}</span>{/if}</div>
						<div class="nbox">
							{#each g.xs as { p, s }}<span class="nb">{cell('이름', p, s)}{cols.직분 && s.title ? ` ${s.title}` : ''}</span>{/each}
						</div>
					</div>
				{/if}
			{/each}
		{/each}
		<p class="sh-foot">부평동부교회 · 개인정보가 담긴 문서이니 사용 후 파기해 주세요.</p>
	</div>
</div>

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
	.out { display: inline-flex; gap: 0.4rem; margin-left: auto; }
	.xl { display: inline-flex; align-items: center; gap: 0.35rem; color: #1d6f42; border-color: #9fd3b4; }
	.xl:hover:not(:disabled) { background: #ebf7f0; color: #1d6f42; border-color: #1d6f42; }
	.xl svg, .pdf svg { width: 18px; height: 18px; }
	.pdf { display: inline-flex; align-items: center; gap: 0.35rem; color: #c4161c; border-color: #f2b1ae; }
	.pdf:hover:not(:disabled) { background: #fdecea; color: #c4161c; border-color: #e2231a; }

	/* 출력·PDF용 표: 화면에서는 화면 밖에 둠 (PDF 만들 때 그려져 있어야 해서 display:none 대신) */
	.print-wrap { position: fixed; left: -10000px; top: 0; width: 174mm; height: 0; overflow: hidden; }
	.sheet { width: 174mm; background: #fff; color: #111; font-size: 10pt; font-family: 'Pretendard', 'Malgun Gothic', sans-serif; }
	.sh-title { text-align: center; margin-bottom: 6mm; padding-bottom: 3mm; border-bottom: 2px solid #111; }
	.sh-title h1 { font-size: 18pt; margin: 0 0 1.5mm; letter-spacing: 0.08em; }
	.sh-title p { margin: 0; font-size: 9.5pt; color: #444; }
	.grp-head { margin: 5mm 0 1.5mm; font-size: 11pt; break-after: avoid; }
	.grp-head span { float: right; font-size: 9.5pt; color: #333; }
	.rt { width: 100%; border-collapse: collapse; table-layout: fixed; }
	.rt th, .rt td { border: 1px solid #888; padding: 1.6mm 2mm; text-align: center; font-size: 9.5pt; }
	.rt th { background: #f1f3f5; font-weight: 700; text-align: center; }
	.rt td.c { text-align: center; }
	/* 이름·직분만 고르면: 소그룹마다 상자 안에 이름을 가나다순으로 */
	.nbox { display: flex; flex-wrap: wrap; gap: 1.6mm 5mm; padding: 3mm 3.5mm; border: 1px solid #888; border-radius: 1.5mm; font-size: 10pt; line-height: 1.5; break-inside: avoid; }
	.nb { white-space: nowrap; }
	.keep { break-inside: avoid; overflow: hidden; }
	/* 항목 고르기 창 */
	.dlg-back { position: fixed; inset: 0; z-index: 70; background: rgba(20, 28, 45, 0.4); }
	.dlg { position: fixed; z-index: 71; left: 50%; top: 50%; transform: translate(-50%, -50%); width: min(420px, calc(100vw - 32px)); margin: 0; }
	.cols { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
	.chk { display: flex; align-items: center; gap: 0.4rem; font-weight: 600; cursor: pointer; }
	.chk input { width: auto; }
	.rt tr { break-inside: avoid; }
	.sh-foot { margin-top: 6mm; font-size: 8pt; color: #777; text-align: right; }
	@media print {
		:global(.site-header), :global(.site-footer), :global(.tabbar), :global(.to-top), :global(.warn), .no-print { display: none !important; }
		:global(.site > main) { padding: 0 !important; max-width: none !important; }
		:global(body) { background: #fff !important; }
		.print-wrap { position: static; width: auto; height: auto; overflow: visible; }
		.sheet { width: auto; }
	}
	@page { size: A4; margin: 20mm 18mm; } /* 문서처럼 상하좌우 여백 (브라우저 인쇄 창의 여백은 '기본값'으로) */
</style>
