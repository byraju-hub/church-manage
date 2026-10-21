<script lang="ts">
	// 명단: 생일·결혼기념일, 직분자, 학습·세례 대상자, 공동체·소그룹별 명단, 교세 통계
	import { registry } from '#lib/registry/store.svelte.ts';
	import { ageOf } from '#lib/registry/derive.ts';
	import { recentSundays } from '#lib/registry/attendance.mock.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';

	const tabs = ['생일·결혼기념일', '직분자 명단', '학습·세례 대상자', '공동체·소그룹별 명단', '교세 통계'];
	let tab = $state(tabs[0]);
	let mode = $state<'week' | 'month'>('month');

	const all = $derived(registry.d.people.map((p) => ({ p, s: registry.summary(p) })));
	const active = $derived(all.filter(({ s }) => s.memberCert));

	// 생일: 음력이면 그해 양력으로 바꿔 보여야 함 (여기서는 표시만)
	const days = (md: string) => {
		const t = new Date();
		const [m, d] = md.split('-').map(Number);
		let n = new Date(t.getFullYear(), m - 1, d);
		const t0 = new Date(t.getFullYear(), t.getMonth(), t.getDate());
		if (n < t0) n = new Date(t.getFullYear() + 1, m - 1, d);
		return Math.round((+n - +t0) / 864e5);
	};
	const upcoming = $derived.by(() => {
		const lim = mode === 'week' ? 7 : 31;
		const out: { name: string; id: string; kind: string; date: string; d: number; lunar: boolean }[] = [];
		for (const { p } of active) {
			if (p.birth_date) { const md = p.birth_date.slice(5); const d = days(md); if (d <= lim) out.push({ name: p.name, id: p.id, kind: '생일', date: p.birth_date, d, lunar: p.birth_lunar }); }
			if (p.wedding_date) { const md = p.wedding_date.slice(5); const d = days(md); if (d <= lim) out.push({ name: p.name, id: p.id, kind: '결혼기념일', date: p.wedding_date, d, lunar: false }); }
		}
		return out.sort((a, b) => a.d - b.d);
	});

	const officers = $derived(
		all
			.flatMap(({ p }) => registry.officesOf(p.id).filter((t) => !t.end_date && t.rank_status !== '사임').map((t) => ({ p, t })))
			.sort((a, b) => a.t.office.localeCompare(b.t.office, 'ko') || a.p.name.localeCompare(b.p.name, 'ko'))
	);

	const targets = $derived(
		all.filter(({ s, p }) => s.memberCert && ['미확인', '원입교인', '학습교인'].includes(s.faith) && (ageOf(p.birth_date) ?? 99) >= 14)
	);

	// 공동체·소그룹별 명단: 2026년 편성표 순서(뿌리 → 줄기 → 열매, 소그룹도 편성표 순서), 마지막에 미지정자.
	// 각 명단은 가나다순, 올해(1월 1일 ~ 지난 주일) 출석률로 색 구분 (80% 이상 / 50~79% / 50% 미만)
	// 올해 등록한 사람은 등록일 이후 주일만 셈
	const YEAR = new Date().getFullYear();
	const WEEKS = recentSundays(60).filter((d) => d.startsWith(`${YEAR}-`));
	const rateOf = (id: string, registered: string | null) => {
		const ws = WEEKS.map((d, i) => ({ d, back: WEEKS.length - 1 - i })).filter((w) => !registered || w.d >= registered);
		if (!ws.length) return 0;
		return Math.round((ws.filter((w) => registry.attended(id, w.d, w.back)).length * 100) / ws.length);
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

	const count = (fn: (x: (typeof all)[number]) => boolean) => all.filter(fn).length;
	const bands = [['0–12세', 0, 12], ['13–19세', 13, 19], ['20–39세', 20, 39], ['40–59세', 40, 59], ['60세 이상', 60, 200]] as const;
</script>

<h1>명단</h1>
<div class="tabs">{#each tabs as t}<button class:on={tab === t} onclick={() => (tab = t)}>{t}</button>{/each}</div>

{#if tab === '생일·결혼기념일'}
	<div class="card">
		<div class="row"><button class:ghost={mode !== 'week'} onclick={() => (mode = 'week')}>이번 주</button><button class:ghost={mode !== 'month'} onclick={() => (mode = 'month')}>이번 달(31일)</button></div>
		<table class="sm"><thead><tr><th>이름</th><th>구분</th><th>날짜</th><th>며칠 뒤</th></tr></thead><tbody>
			{#each upcoming as u}<tr><td><a href="/{u.id}">{u.name}</a></td><td>{u.kind}</td><td>{u.date}{u.lunar ? ' (음력)' : ''}</td><td>{u.d === 0 ? '오늘' : `${u.d}일`}</td></tr>{:else}<tr><td colspan="4" class="muted">해당 없음</td></tr>{/each}
		</tbody></table>
		<p class="muted">더 필요한 것: 음력 생일은 그해 양력으로 바꿔 보여야 함 (지금 화면은 음력 표시만).</p>
	</div>
{:else if tab === '직분자 명단'}
	<div class="card">
		<table class="sm"><thead><tr><th>직분</th><th>구분</th><th>이름</th><th>시작일</th></tr></thead><tbody>
			{#each officers as { p, t }}<tr><td>{t.office}</td><td>{t.rank_status}</td><td><a href="/{p.id}">{p.name}</a></td><td>{t.start_date ?? '미상'}</td></tr>{/each}
		</tbody></table>
		<p class="muted">더 필요한 것: 임직일이 비어 있는 사람이 많을 수 있음.</p>
	</div>
{:else if tab === '학습·세례 대상자'}
	<div class="card">
		<p class="muted">재적 교인 중 만 14세 이상이면서 세례 기록이 없는 사람 (미확인·원입·학습).</p>
		<table class="sm"><thead><tr><th>이름</th><th>나이</th><th>신급</th><th>등록일</th></tr></thead><tbody>
			{#each targets as { p, s }}<tr><td><a href="/{p.id}">{p.name}</a></td><td>{ageOf(p.birth_date) ?? '-'}</td><td>{s.faith}</td><td>{s.registered ?? '미상'}</td></tr>{:else}<tr><td colspan="4" class="muted">해당 없음</td></tr>{/each}
		</tbody></table>
		<p class="muted">더 필요한 것: 신급 '미확인'을 먼저 확인해야 정확함.</p>
	</div>
{:else if tab === '공동체·소그룹별 명단'}
	<p class="legend-att muted">{YEAR}년 출석률 (1월 1일 ~ {WEEKS.at(-1)?.slice(5).replace('-', '/')}, 주일 {WEEKS.length}회) ·
		<span class="hi">● 80% 이상</span> <span class="mid">● 50~79%</span> <span class="lo">● 50% 미만</span> <span class="lead">● 인도자</span>
		<span>(이름 옆 숫자는 개인 출석률)</span></p>
	{#each byGroup as c}
		<h2 style="margin:1.2rem 0 .5rem">{c.community}</h2>
		{#each c.groups as g}
			<div class="card"><h3 style="margin:0 0 .5rem">{g.name} <span class="muted">({g.xs.length}명)</span> <small class="{band(g.rate)}">평균 출석률 {g.rate}%</small></h3>
				<div class="names">
					{#each g.xs as { p, s, rate }}{@const lead = leaders.has(p.id)}<a href="/{p.id}" class="nm {lead ? 'lead' : band(rate)}" title="{lead ? '인도자 · ' : ''}올해 출석률 {rate}%">{p.name}{s.title ? ` ${s.title}` : ''}<small>{lead ? '인도자 · ' : ''}{rate}%</small></a>{/each}
				</div>
			</div>
		{/each}
	{/each}
{:else}
	<div class="grid">
		<div class="stat"><b>{count(({ s }) => s.status === '재적')}</b><span>재적</span></div>
		<div class="stat"><b>{count(({ s }) => s.status === '보류')}</b><span>보류</span></div>
		<div class="stat"><b>{count(({ s }) => ['전출', '별세', '제적'].includes(s.status))}</b><span>전출·별세·제적</span></div>
	</div>
	<div class="card"><h2>신급별 (재적·보류)</h2>
		<table class="sm"><tbody>
			{#each ['세례교인', '유아세례교인', '학습교인', '원입교인', '미확인'] as f}<tr><td>{f}</td><td>{count(({ s }) => s.memberCert && s.faith === f)}명</td></tr>{/each}
		</tbody></table></div>
	<div class="card"><h2>성별·나이대 (재적·보류)</h2>
		<table class="sm"><thead><tr><th></th><th>남</th><th>여</th></tr></thead><tbody>
			{#each bands as [label, lo, hi]}<tr><td>{label}</td>
				{#each ['M', 'F'] as g}<td>{count(({ p, s }) => s.memberCert && p.gender === g && (ageOf(p.birth_date) ?? -1) >= lo && (ageOf(p.birth_date) ?? -1) <= hi)}</td>{/each}</tr>{/each}
		</tbody></table></div>
	<p class="muted">더 필요한 것: 노회(합동) 보고 서식. 기본 통계 화면은 실제 시스템에 아직 없습니다.</p>
{/if}

<style>
	/* 출석률 색: 80% 이상 초록 / 50~79% 연한 주황 / 50% 미만 연한 회색 (--c 바탕색, --t 글자색) */
	.hi { --c: #2f9e44; --t: #2f9e44; } .mid { --c: #ffa94d; --t: #fd7e14; } .lo { --c: #ced4da; --t: #9aa1a9; }
	.lead { --c: #1c7ed6; --t: #1c7ed6; } /* 인도자는 출석률과 상관없이 파랑 */
	small.hi, small.mid, small.lo, .legend-att span[class] { color: var(--t); font-weight: 700; }
	.legend-att { display: flex; flex-wrap: wrap; gap: 0.3rem 0.8rem; align-items: center; }
	.names { display: flex; flex-wrap: wrap; gap: 0.35rem; }
	.nm { display: inline-flex; align-items: baseline; gap: 0.25rem; padding: 0.2rem 0.55rem; border-radius: 8px; font-weight: 600; color: var(--t); background: color-mix(in srgb, var(--c) 12%, #fff); border: 1px solid color-mix(in srgb, var(--c) 40%, #fff); text-decoration: none; }
	.nm small { font-size: 0.72rem; font-weight: 500; opacity: 0.85; }
</style>
