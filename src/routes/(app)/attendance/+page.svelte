<script lang="ts">
	// 주일 출석: 한 주일의 전체 명단을 뿌리 → 줄기 → 열매 공동체, 편성표의 소그룹 순서로 나열하고 마지막에 소그룹 미지정자.
	// 소그룹 안에서는 가나다순. 출석은 스위치로 체크, 특이사항(결석 사유 등)은 옆 칸에 적음
	import { page } from '$app/state';
	import { tick } from 'svelte';
	import { registry } from '#lib/registry/store.svelte.ts';
	import { recentSundays } from '#lib/registry/attendance.mock.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';

	// 고를 수 있는 주일: 올해 주일 전체 (최근 주일이 맨 위). 연초라 주일이 적으면 최근 8주
	const ALL = recentSundays(53);
	const YEAR = ALL[ALL.length - 1].slice(0, 4);
	const thisYear = ALL.filter((d) => d.startsWith(`${YEAR}-`));
	const WEEKS = thisYear.length >= 8 ? thisYear : ALL.slice(-8);
	// 기본값: 오늘이 주일이면 오늘, 아니면 지난 주일
	let date = $state(WEEKS[WEEKS.length - 1]);
	const weeksFromEnd = $derived(WEEKS.length - 1 - WEEKS.indexOf(date));
	const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
	const dow = (iso: string) => (iso === WEEKS[WEEKS.length - 1] ? ' · 이번 주일' : '');

	type Row = { p: ReturnType<typeof registry.person> & {}; s: ReturnType<typeof registry.summary>; group: string; community: string; first: boolean };
	const rows = $derived.by(() => {
		const members = registry.d.people.map((p) => ({ p, s: registry.summary(p) })).filter(({ s }) => s.memberCert);
		const byName = (a: { p: { name: string } }, b: { p: { name: string } }) => a.p.name.localeCompare(b.p.name, 'ko');
		const out: Row[] = [];
		for (const c of COMMUNITY_DEFS) {
			for (const g of c.groups) {
				const list = members.filter(({ s }) => s.community === c.name && s.smallGroup === g.name).sort(byName);
				list.forEach((x, i) => out.push({ ...x, group: g.name, community: c.name, first: i === 0 }));
			}
		}
		// 소그룹 미지정자: 소그룹이 없는 재적 장년
		members.filter(({ s }) => !s.smallGroup && s.cat2 === '장년').sort(byName)
			.forEach((x, i) => out.push({ ...x, group: '미지정', community: '-', first: i === 0 }));
		return out;
	});
	const isPresent = (pid: string) => registry.attended(pid, date, weeksFromEnd);
	const totals = $derived.by(() => {
		const names = [...COMMUNITY_DEFS.map((c) => c.name), '-'];
		return names.map((n) => {
			const l = rows.filter((r) => r.community === n);
			return { name: n === '-' ? '소그룹 미지정' : n, total: l.length, present: l.filter((r) => isPresent(r.p.id)).length };
		}).filter((t) => t.total);
	});
	const sumPresent = $derived(totals.reduce((s, t) => s + t.present, 0));

	function mark(pid: string, ok: boolean) {
		registry.setAttendance(date, pid, ok, registry.attendanceMark(pid, date)?.reason ?? null);
	}
	function note(pid: string, text: string) {
		registry.setAttendance(date, pid, isPresent(pid), text.trim() || null);
	}

	// 소그룹 화면의 '출석 등록'으로 들어오면 그 소그룹 위치로 이동
	let jumped = false;
	$effect(() => {
		const g = page.url.searchParams.get('group');
		if (!g || jumped || !rows.length) return;
		jumped = true;
		// 화면 전환 뒤 맨 위로 돌아가는 스크롤이 끝난 다음에 이동
		tick().then(() => setTimeout(() => {
			const el = document.getElementById(`g-${g}`);
			if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 90 });
		}, 120));
	});
</script>

<h1>출석</h1>
{#if !registry.perms.edit}
	<div class="warn">수정 권한이 꺼져 있어 출석을 등록할 수 없습니다. (최고관리자에게 수정 권한을 받아야 합니다)</div>
{/if}
<p class="muted" style="margin-top:-.6rem">실제로는 기존 출석부에서 인도자가 직접 체크합니다. 여기서는 그 화면이 어떤 모양일지 시험해 봅니다.</p>

<div class="card att-bar">
	<label class="row" style="gap:.4rem"><span class="muted">주일</span>
		<select bind:value={date}>{#each [...WEEKS].reverse() as d}<option value={d}>{d} ({md(d)}{dow(d)})</option>{/each}</select></label>
	<span class="sum">출석 <b>{sumPresent}</b> / {rows.length}명</span>
	<span class="muted per">{#each totals as t}<span>{t.name} {t.present}/{t.total}</span>{/each}</span>
</div>

<div class="card" style="padding:0;overflow-x:auto">
	<table class="sm att">
		<colgroup><col style="width:4.2rem" /><col style="width:16%" /><col style="width:13%" /><col style="width:14%" /><col style="width:13%" /><col /></colgroup>
		<thead><tr><th>출석</th><th>이름</th><th>직분</th><th>소그룹</th><th>공동체</th><th>특이사항</th></tr></thead>
		<tbody>
			{#each rows as r (r.p.id)}
				{@const ok = isPresent(r.p.id)}
				<tr class:on={ok} class:first={r.first} id={r.first ? `g-${r.group}` : undefined}>
					<td><label class="switch"><input type="checkbox" checked={ok} disabled={!registry.perms.edit} onchange={(e) => mark(r.p.id, e.currentTarget.checked)} aria-label="{r.p.name} 출석" /><i></i></label></td>
					<td><a href="/{r.p.id}"><b>{r.p.name}</b></a></td>
					<td>{r.s.title || '-'}</td>
					<td>{r.group}</td>
					<td class="muted">{r.community}</td>
					<td><input value={registry.attendanceMark(r.p.id, date)?.reason ?? ''} disabled={!registry.perms.edit} placeholder={ok ? '' : '결석 사유 (예: 출장, 병환)'} onchange={(e) => note(r.p.id, e.currentTarget.value)} /></td>
				</tr>
			{:else}
				<tr><td colspan="6" class="muted">해당 교인이 없습니다.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="muted">입력한 출석은 대시보드·공동체 편성표·통계에 바로 반영됩니다.</p>

<style>
	.att-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1.2rem; }
	.sum b { color: #2f9e44; font-size: 1.1rem; }
	.per { display: flex; flex-wrap: wrap; gap: 0.2rem 0.9rem; font-size: 0.84rem; }
	.att { table-layout: fixed; min-width: 640px; }
	.att td { vertical-align: middle; }
	.att td:nth-child(-n + 5) { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.att tr.first td { border-top: 2px solid var(--line-strong); }
	.att tr.on td { background: #ebfbee; }
	.att td input:not([type]) { padding: 0.35rem 0.55rem; font-size: 0.85rem; }
	/* 출석 스위치 (켜짐: 초록) */
	.switch { position: relative; display: inline-block; width: 44px; height: 26px; cursor: pointer; }
	.switch input { position: absolute; opacity: 0; width: 100%; height: 100%; margin: 0; cursor: pointer; }
	.switch i { position: absolute; inset: 0; border-radius: 999px; background: #dee2ea; transition: background 0.15s; pointer-events: none; }
	.switch i::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0, 0, 0, 0.25); transition: transform 0.15s; }
	.switch input:checked + i { background: #2f9e44; }
	.switch input:checked + i::after { transform: translateX(18px); }
	.switch input:focus-visible + i { outline: 2px solid var(--primary); outline-offset: 2px; }
	.switch input:disabled { cursor: not-allowed; }
</style>
