<script lang="ts">
	// 대시보드: 통합 검색, 숫자 카드 8개, 캘린더, 출석 추이, 생일, 장기 결석, 새가족, 최근 심방
	import { registry } from '#lib/registry/store.svelte.ts';
	import { recentSundays } from '#lib/registry/attendance.mock.ts';
	import GlobalSearch from '#lib/components/GlobalSearch.svelte';
	import Calendar from '#lib/components/Calendar.svelte';

	const today = new Date();
	const WEEKS = recentSundays(8, today);
	const dateLabel = today.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
	const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());

	const rows = $derived(registry.d.people.map((p) => ({ p, s: registry.summary(p) })));
	const members = $derived(rows.filter((r) => r.s.memberCert));
	const joined = $derived(rows.filter((r) => r.s.status === '재적').length);

	// ---- 주일 오전예배 출석 (교적 프로그램 출석 화면에서 등록. 지금은 가상 샘플) ----
	// 전체 출석 인원 = 출석 화면에서 입력한 값 (명단 체크 + 그 외). 출석률은 출석 명단 인원 기준
	const roster = $derived(registry.worshipRoster());
	const weekly = $derived(
		WEEKS.map((date, i) => ({
			date,
			n: registry.worshipTotal(date, roster.filter((p) => registry.attended(p.id, date, WEEKS.length - 1 - i)).length)
		}))
	);
	const latest = $derived(weekly[weekly.length - 1]);
	const prev = $derived(weekly[weekly.length - 2]);
	const rate = $derived(roster.length ? Math.round((latest.n * 100) / roster.length) : 0);
	const delta = $derived(latest.n - prev.n);

	let view = $state<'chart' | 'table'>('chart');
	let hover = $state<number | null>(null);

	// 차트 좌표
	const W = 560, H = 236, L = 34, R = 8, T = 22, B = 30;
	const maxN = $derived(Math.max(...weekly.map((w) => w.n), 0));
	const top = $derived(Math.max(4, Math.ceil(maxN / 4) * 4));
	const ticks = $derived([0, top / 2, top]);
	const slot = (W - L - R) / WEEKS.length;
	const bw = slot * 0.56;
	const yOf = (v: number) => T + (H - T - B) * (1 - v / top);
	const barPath = (i: number, v: number) => {
		const x = L + slot * i + (slot - bw) / 2;
		const y = yOf(v), h = H - B - y, r = Math.min(4, bw / 2, h);
		if (h <= 0) return '';
		return `M${x},${y + h} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + bw - r},${y} Q${x + bw},${y} ${x + bw},${y + r} L${x + bw},${y + h} Z`;
	};
	const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;

	// ---- 공동체별 이번 주일 출석 ----
	let unit = $state<'community' | 'group'>('community');
	const byCommunity = $derived.by(() => {
		const m = new Map<string, { total: number; present: number }>();
		for (const { p, s } of members) {
			// 주일 오후 소그룹 모임 출석 (홈페이지 출석부에서 인도자가 등록). 소그룹이 없는 사람은 모임이 없으므로 뺌
			if (!s.smallGroup) continue;
			const k = unit === 'community' ? s.community : s.smallGroup;
			const cur = m.get(k) ?? { total: 0, present: 0 };
			cur.total++;
			if (registry.groupAttended(p.id, latest.date, 0)) cur.present++;
			m.set(k, cur);
		}
		return [...m.entries()].sort((a, b) => (unit === 'community' ? b[1].total - a[1].total : b[1].present / b[1].total - a[1].present / a[1].total));
	});

	// ---- 장기 결석: 교인구분이 '교인 › … › 예배출석·가끔출석'인 사람 중 2달 이상 주일에 나오지 않은 사람 ----
	// (재적 상태가 아니라 교인구분 3단계를 기준으로 함. 불출석으로 분류된 사람은 이미 아는 경우라 뺌)
	// [실제 시스템] 출석부의 주일 출석 기록에서 마지막 출석일을 구해 같은 규칙으로 고릅니다.
	const LONG = recentSundays(26, today); // 최근 반년 주일
	const twoMonthsAgo = (() => { const d = new Date(t0); d.setMonth(d.getMonth() - 2); return d; })();
	const absent = $derived(
		rows
			.filter(({ s }) => s.cat1 === '교인' && (s.cat3 === '예배출석' || s.cat3 === '가끔출석'))
			.map(({ p, s }) => {
				let streak = 0;
				let lastSeen: string | null = null;
				for (let k = 0; k < LONG.length; k++) {
					if (registry.attended(p.id, LONG[LONG.length - 1 - k], k)) { lastSeen = LONG[LONG.length - 1 - k]; break; }
					streak++;
				}
				return { p, s, streak, lastSeen };
			})
			.filter((x) => !x.lastSeen || new Date(x.lastSeen) < twoMonthsAgo)
			.sort((a, b) => b.streak - a.streak)
	);

	// ---- 생일·결혼기념일 ----
	// [실제 시스템] 음력 생일은 그해 양력 날짜로 바꿔서 계산해야 합니다. (store.svelte.ts 의 캘린더 주석 참고)
	let range = $state<'week' | 'month'>('week');
	const occurrences = $derived.by(() => {
		const out: { id: string; name: string; kind: '생일' | '결혼기념일'; md: string; d: number; n: number; lunar: boolean; group: string }[] = [];
		const next = (iso: string) => {
			const [, m, d] = iso.split('-').map(Number);
			let n = new Date(today.getFullYear(), m - 1, d);
			if (n < t0) n = new Date(today.getFullYear() + 1, m - 1, d);
			return { n, days: Math.round((+n - +t0) / 864e5) };
		};
		for (const { p, s } of members) {
			if (p.birth_date) {
				const { n, days } = next(p.birth_date);
				out.push({ id: p.id, name: p.name, kind: '생일', md: `${n.getMonth() + 1}월 ${n.getDate()}일`, d: days, n: n.getFullYear() - +p.birth_date.slice(0, 4), lunar: p.birth_lunar, group: s.smallGroup });
			}
			if (p.wedding_date) {
				const { n, days } = next(p.wedding_date);
				out.push({ id: p.id, name: p.name, kind: '결혼기념일', md: `${n.getMonth() + 1}월 ${n.getDate()}일`, d: days, n: n.getFullYear() - +p.wedding_date.slice(0, 4), lunar: false, group: s.smallGroup });
			}
		}
		return out.sort((a, b) => a.d - b.d);
	});
	// 이번 주(일요일~토요일) 생일자 수 (결혼기념일 제외)
	const weekBirthdays = $derived.by(() => {
		const sun = new Date(t0); sun.setDate(t0.getDate() - t0.getDay());
		const days = new Set(Array.from({ length: 7 }, (_, i) => { const d = new Date(sun); d.setDate(sun.getDate() + i); return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }));
		return members.filter(({ p }) => p.birth_date && days.has(p.birth_date.slice(5))).length;
	});
	// 지난 주일의 소그룹·교육부서 출석
	// [실제 시스템] 소그룹 출석과 교육부서 출석은 지금 홈페이지(출석부·교육부서 보고서)에서 운영 중입니다.
	//   연동하면 그 주일의 출석 인원·재적 인원을 홈페이지에서 가져와 여기 숫자에 넣습니다. (지금은 가상 출석 샘플)
	const pctOf = (x: { present: number; total: number }) => (x.total ? Math.round((x.present * 100) / x.total) : 0);
	const attOf = (list: typeof members) => ({ total: list.length, present: list.filter(({ p }) => registry.attended(p.id, latest.date, 0)).length });
	const groupAtt = $derived.by(() => { const l = members.filter(({ s }) => !!s.smallGroup); return { total: l.length, present: l.filter(({ p }) => registry.groupAttended(p.id, latest.date, 0)).length }; });
	const eduAtt = $derived(attOf(members.filter(({ p }) => !!p.edu_dept)));
	// 이번 분기(오늘이 속한 달의 분기) 새가족 등록
	const quarter = Math.floor(today.getMonth() / 3) + 1;
	const monthAgo = (() => { const d = new Date(t0); d.setDate(d.getDate() - 30); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
	const quarterStart = `${today.getFullYear()}-${String((quarter - 1) * 3 + 1).padStart(2, '0')}-01`;
	const quarterNew = $derived(rows.filter(({ p, s }) => s.registered && s.registered >= quarterStart && registry.statusOf(p.id).some((e) => e.reason === '새가족')).length);
	const shown = $derived(occurrences.filter((o) => o.d <= (range === 'week' ? 6 : 30)).slice(0, 8));
	// 해당 기간에 아무도 없으면 가장 가까운 일정을 대신 보여줌
	const upcoming = $derived(shown.length ? [] : occurrences.slice(0, 4));

	// ---- 새가족 (등록 60일 이내) ----
	const newcomers = $derived(
		rows
			.filter(({ s }) => s.registered && s.status === '재적' && (+t0 - +new Date(s.registered)) / 864e5 <= 60 && (+t0 - +new Date(s.registered)) >= 0)
			.sort((a, b) => (b.s.registered ?? '').localeCompare(a.s.registered ?? ''))
	);

	// ---- 최근 심방 (심방 권한자만) ----
	const recentVisits = $derived(registry.d.visits.filter((v) => new Date(v.visit_date) <= t0).sort((a, b) => b.visit_date.localeCompare(a.visit_date)).slice(0, 4));
	const visits30 = $derived(registry.d.visits.filter((v) => (+t0 - +new Date(v.visit_date)) / 864e5 <= 30 && new Date(v.visit_date) <= t0).length);
	const nameOf = (id: string) => registry.person(id)?.name ?? '';
	// 장기 결석 알림에서 '장기결석자'로 분류 (교인구분 3단계만 바꿈)
	function markLong(p: { id: string; category_id: string | null }) {
		if (p.category_id) registry.updatePerson(p.id, { category_id: p.category_id.replace(/\.[asnl]$/, '.l') });
	}
	const longCount = $derived(rows.filter(({ s }) => s.cat3 === '장기결석자' && s.memberCert).length);
	// 장기 결석자 → 심방 계획: 이미 앞으로 잡힌 심방이 있으면 그 날짜를 보여 줌
	const todayIso = `${t0.getFullYear()}-${String(t0.getMonth() + 1).padStart(2, '0')}-${String(t0.getDate()).padStart(2, '0')}`;
	const nextWeek = (() => { const d = new Date(t0); d.setDate(d.getDate() + 7); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
	const planOf = (pid: string) => registry.d.visits.filter((v) => v.person_id === pid && v.visit_date > todayIso).map((v) => v.visit_date).sort()[0];
</script>

{#snippet icon(name: string)}
	<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
		{#if name === 'users'}<path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
		{:else if name === 'check'}<circle cx="12" cy="12" r="9" /><path d="M8 12.5l3 3 5-6" />
		{:else if name === 'group'}<circle cx="12" cy="7" r="3" /><circle cx="5" cy="10" r="2.5" /><circle cx="19" cy="10" r="2.5" /><path d="M7 21v-2a5 5 0 0110 0v2M1.5 19v-1a3.5 3.5 0 015-3.2M22.5 19v-1a3.5 3.5 0 00-5-3.2" />
		{:else if name === 'book'}<path d="M4 4.5A2.5 2.5 0 016.5 2H20v17H6.5A2.5 2.5 0 004 21.5z" /><path d="M4 21.5A2.5 2.5 0 016.5 19H20v3H6.5" />
		{:else if name === 'alert'}<path d="M12 3l10 18H2z" /><path d="M12 10v5M12 18v.01" />
		{:else if name === 'visit'}<path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /><path d="M10 20v-6h4v6" />
		{:else if name === 'gift'}<rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M5 12v8a1 1 0 001 1h12a1 1 0 001-1v-8" /><path d="M7.5 8a2.5 2.5 0 010-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 010 5" />
		{:else}<path d="M12 21s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 11c0 5.4-7 10-7 10z" />{/if}
	</svg>
{/snippet}

<GlobalSearch />

<section class="hero">
	<div>
		<small>{dateLabel}</small>
		<h1>부평동부교회 현황</h1>
		<p>재적 교인 {joined}명 · 이번 주일 출석 {latest.n}명({rate}%)</p>
	</div>
	<div class="actions">
		<a class="btn light" href="/members">교인 목록</a>
		{#if registry.perms.edit}<a class="btn glass" href="/new">+ 교인 등록</a>{/if}
		<a class="btn glass" href="/reports">명단 · 통계</a>
	</div>
</section>

<div class="kpis kpis-8">
	<a class="kpi" href="/members">
		<span class="ico">{@render icon('users')}</span>
		<div><b>{joined}</b><span>재적 교인</span></div>
	</a>
	<a class="kpi" href="/stats?tab=주일 출석">
		<span class="ico green">{@render icon('check')}</span>
		<div>
			<b>{latest.n}<em class:up={delta > 0} class:down={delta < 0}>{delta === 0 ? '±0' : delta > 0 ? `▲${delta}` : `▼${-delta}`}</em></b>
			<span>{md(latest.date)} 주일 출석 · {rate}%</span>
		</div>
	</a>
	<a class="kpi" href="/stats?tab=소그룹 출석" title="주일 오후 소그룹 모임 출석 (홈페이지 출석부에서 인도자가 등록)">
		<span class="ico blue2">{@render icon('group')}</span>
		<div><b>{groupAtt.present}<small class="of">/{groupAtt.total}</small></b><span>{md(latest.date)} 소그룹 출석 · {pctOf(groupAtt)}%</span></div>
	</a>
	<a class="kpi" href="/stats?tab=주일 출석#edu" title="홈페이지 교육부서 출석과 연동할 자리">
		<span class="ico indigo">{@render icon('book')}</span>
		<div><b>{eduAtt.present}<small class="of">/{eduAtt.total}</small></b><span>{md(latest.date)} 교육부서 출석 · {pctOf(eduAtt)}%</span></div>
	</a>
	<a class="kpi" href="/newcomers">
		<span class="ico violet">{@render icon('heart')}</span>
		<div><b>{quarterNew}</b><span>새가족 ({quarter}/4분기)</span></div>
	</a>
	{#if registry.perms.visit}
		<a class="kpi" href="/visits?from={monthAgo}">
			<span class="ico teal">{@render icon('visit')}</span>
			<div><b>{visits30}</b><span>최근 한 달 심방</span></div>
		</a>
	{:else}
		<div class="kpi"><span class="ico teal">{@render icon('visit')}</span><div><b>-</b><span>최근 한 달 심방 (권한 필요)</span></div></div>
	{/if}
	<a class="kpi" href="#absent">
		<span class="ico rose">{@render icon('alert')}</span>
		<div><b>{absent.length}</b><span>장기 결석자 (2달 이상)</span></div>
	</a>
	<a class="kpi" href="/documents?doc=생일 명단">
		<span class="ico amber">{@render icon('gift')}</span>
		<div><b>{weekBirthdays}</b><span>이번 주 생일자</span></div>
	</a>
</div>

<section class="card">
	<div class="card-head"><h2>캘린더</h2><span class="sub">* 색상별로 항목을 구분하고, 항목을 누르면 해당 내용만 표시됩니다.</span></div>
	<Calendar />
</section>

<div class="dash-grid">
	<section class="card">
		<div class="card-head">
			<div>
				<h2>주일 출석 추이</h2>
				<span class="sub">최근 8주 · 전체 출석 인원 (출석 명단 {roster.length}명 기준 출석률) · 가상 출석 샘플</span>
			</div>
			<div class="seg" role="tablist" aria-label="보기 방식">
				<button type="button" class:on={view === 'chart'} onclick={() => (view = 'chart')}>그래프</button>
				<button type="button" class:on={view === 'table'} onclick={() => (view = 'table')}>표</button>
			</div>
		</div>

		{#if view === 'chart'}
			<div class="chart">
				<svg viewBox="0 0 {W} {H}" role="img" aria-label="최근 8주 주일 출석 인원 막대그래프" onmouseleave={() => (hover = null)}>
					{#each ticks as t}
						<line x1={L} x2={W - R} y1={yOf(t)} y2={yOf(t)} stroke="#e5e9f2" stroke-width="1" />
						<text x={L - 8} y={yOf(t) + 4} text-anchor="end" font-size="11" fill="#66718a">{t}</text>
					{/each}
					{#each weekly as w, i}
						<path class="bar-rect" d={barPath(i, w.n)} fill="#3563e9" opacity={hover === null || hover === i ? 1 : 0.45} />
						<text x={L + slot * i + slot / 2} y={H - 10} text-anchor="middle" font-size="11" fill="#66718a">{md(w.date)}</text>
						{#if i === weekly.length - 1 || hover === i}
							<text x={L + slot * i + slot / 2} y={yOf(w.n) - 6} text-anchor="middle" font-size="12" font-weight="700" fill="#1b2433">{w.n}</text>
						{/if}
						<rect class="bar-hit" x={L + slot * i} y={T} width={slot} height={H - T - B} role="presentation" onmouseenter={() => (hover = i)} />
					{/each}
				</svg>
				{#if hover !== null}
					<div class="tip" style="left:{((L + slot * hover + slot / 2) / W) * 100}%; top:{(yOf(weekly[hover].n) / H) * 100}%">
						{weekly[hover].n}명
						<small>{weekly[hover].date} · {roster.length ? Math.round((weekly[hover].n * 100) / roster.length) : 0}%</small>
					</div>
				{/if}
			</div>
		{:else}
			<table class="sm">
				<thead><tr><th>주일</th><th>출석</th><th>출석률</th></tr></thead>
				<tbody>
					{#each [...weekly].reverse() as w}
						<tr><td>{w.date}</td><td>{w.n}명</td><td>{roster.length ? Math.round((w.n * 100) / roster.length) : 0}%</td></tr>
					{/each}
				</tbody>
			</table>
		{/if}
	</section>

	<section class="card">
		<div class="card-head">
			<h2>생일 · 결혼기념일</h2>
			<div class="seg">
				<button type="button" class:on={range === 'week'} onclick={() => (range = 'week')}>이번 주</button>
				<button type="button" class:on={range === 'month'} onclick={() => (range = 'month')}>30일</button>
			</div>
		</div>
		{#snippet occ(o: (typeof occurrences)[number])}
			<div class="li">
				<span class="avatar {o.kind === '생일' ? 'warm' : 'rose'}">{o.name.slice(0, 1)}</span>
				<div class="grow">
					<b><a href="/{o.id}">{o.name}</a></b>
					<small>{o.kind} · {o.md}{o.lunar ? ' (음력)' : ''} · {o.kind === '생일' ? `만 ${o.n}세` : `${o.n}주년`}{o.group ? ` · ${o.group}` : ''}</small>
				</div>
				<span class="dday" class:today={o.d === 0}>{o.d === 0 ? '오늘' : `D-${o.d}`}</span>
			</div>
		{/snippet}
		{#each shown as o (o.id + o.kind)}
			{@render occ(o)}
		{:else}
			<p class="empty" style="padding-bottom: 0.4rem">{range === 'week' ? '이번 주' : '30일 안'}에 해당하는 사람이 없습니다.</p>
			{#if upcoming.length}
				<p class="sub" style="margin: 0.2rem 0 0.7rem; color: var(--muted); font-size: 0.82rem; font-weight: 600">가장 가까운 일정</p>
				{#each upcoming as o (o.id + o.kind)}
					{@render occ(o)}
				{/each}
			{/if}
		{/each}
	</section>
</div>

<div class="dash-grid even">
	<section class="card">
		<div class="card-head"><h2>공동체 · 소그룹 출석 <small class="muted" style="font-weight:500;font-size:.78rem">주일 오후 소그룹 모임</small></h2>
			<div class="seg"><button type="button" class:on={unit === 'community'} onclick={() => (unit = 'community')}>공동체</button><button type="button" class:on={unit === 'group'} onclick={() => (unit = 'group')}>소그룹</button></div></div>
		<p class="sub" style="margin:-.4rem 0 .6rem;color:var(--muted);font-size:.8rem">{md(latest.date)} 주일 · 홈페이지 출석부(인도자 등록) 기준{unit === 'group' ? ' · 출석률 높은 순' : ''}</p>
		<div style="max-height:{unit === 'group' ? '420px' : 'none'};overflow:auto">
		{#each byCommunity as [name, c]}
			<div class="li" style="flex-direction:column; align-items:stretch; gap:.4rem">
				<div class="row" style="justify-content:space-between"><b style="font-size:.93rem">{name}</b><span class="muted" style="font-size:.85rem">{c.present} / {c.total}명 · {Math.round((c.present * 100) / c.total)}%</span></div>
				<div class="track"><i style="width:{(c.present * 100) / c.total}%"></i></div>
			</div>
		{:else}
			<p class="empty">재적 교인이 없습니다.</p>
		{/each}
		</div>
	</section>

	<section class="card" id="absent">
		<div class="card-head"><h2>장기 결석 알림</h2><span class="sub">예배출석·가끔출석 교인 중 2달 이상 결석 · {absent.length}명</span></div>
		<div style="max-height:430px;overflow:auto;padding-right:.45rem">
		{#each absent as a (a.p.id)}
			<div class="li">
				<span class="avatar rose">{a.p.name.slice(0, 1)}</span>
				<div class="grow">
					<b><a href="/{a.p.id}">{a.p.name}</a> <span class="dday today" title={a.lastSeen ? `마지막 출석 ${a.lastSeen}` : '반년 넘게 출석 없음'}>{a.streak >= LONG.length ? '반년 이상' : `${a.streak}주째`}</span></b>
					<small>{a.s.smallGroup || '소그룹 없음'} · {a.s.title || a.s.faith}</small>
				</div>
				<div class="li-acts">
					{#if registry.perms.edit}<button type="button" class="ghost xs" title="교인구분 3단계를 '장기결석자'로 바꿉니다" onclick={() => markLong(a.p)}>장기결석자로</button>{/if}
					{#if registry.perms.visit}{#if planOf(a.p.id)}<a class="tag now" href="/visits?tab=list&q={encodeURIComponent(a.p.name)}">심방 예정 {planOf(a.p.id)?.slice(5)}</a>{:else}<a class="btn ghost xs" href="/visits?person={a.p.id}&date={nextWeek}&kind=일반">심방 계획</a>{/if}{/if}
				</div>
			</div>
		{:else}
			<p class="empty">2달 이상 결석한 예배출석·가끔출석 교인이 없습니다.</p>
		{/each}
		</div>
		<p style="margin:.7rem 0 0;font-size:.88rem"><a href="/members?l3=장기결석자">이미 '장기결석자'로 분류된 교인 {longCount}명 보기 →</a></p>
	</section>
</div>

<div class="dash-grid even">
	<section class="card">
		<div class="card-head"><h2>새가족</h2><span class="sub">등록 후 60일 이내 · {newcomers.length}명</span></div>
		<div style="max-height:430px;overflow:auto;padding-right:.45rem">
		{#each newcomers as { p, s } (p.id)}
			<div class="li">
				<span class="avatar">{p.name.slice(0, 1)}</span>
				<div class="grow">
					<b><a href="/{p.id}">{p.name}</a></b>
					<small>등록 {s.registered}{p.guide_person_id ? ` · 인도 ${nameOf(p.guide_person_id)}` : p.guide_name ? ` · 인도 ${p.guide_name}` : ''}</small>
				</div>
				<span class="dday">{s.faith}</span>
			</div>
		{:else}
			<p class="empty">최근 60일 안에 등록한 새가족이 없습니다.</p>
		{/each}
		</div>
		<p style="margin:.7rem 0 0"><a href="/newcomers">새가족 정착 현황 보기 →</a></p>
	</section>

	<section class="card">
		<div class="card-head"><h2>최근 심방</h2><span class="sub">심방 권한이 있는 교역자만 볼 수 있음</span></div>
		{#if registry.perms.visit}
			{#each recentVisits as v (v.id)}
				<div class="li">
					<span class="avatar warm">{nameOf(v.person_id).slice(0, 1)}</span>
					<div class="grow">
						<b><a href="/{v.person_id}">{nameOf(v.person_id)}</a></b>
						<small>{v.visit_date} · {v.pastor} · {v.content.length > 34 ? v.content.slice(0, 34) + '…' : v.content}</small>
					</div>
				</div>
			{:else}
				<p class="empty">심방 기록이 없습니다.</p>
			{/each}
		{:else}
			<p class="empty">심방 권한이 꺼져 있어 볼 수 없습니다.<br />(최고관리자가 심방 권한을 준 사용자만 볼 수 있습니다)</p>
		{/if}
	</section>
</div>

<section class="card" style="margin-top:1.1rem">
	<div class="card-head"><h2>바로 가기</h2></div>
	<div class="quick">
		<a href="/members">교인 목록</a>
		<a href="/communities">공동체 편성표</a>
		<a href="/communities/roster">공동체 명단</a>
		<a href="/attendance">출석</a>
		<a href="/visits">심방</a>
		<a href="/households">세대</a>
		<a href="/stats">통계</a>
	</div>
</section>
