<script lang="ts">
	// 주일 오전예배 출석 등록 (주일 오후 소그룹 모임 출석은 홈페이지 출석부에서 인도자가 따로 등록)
	// 한 주일의 전체 명단을 뿌리 → 줄기 → 열매 공동체, 편성표의 소그룹 순서로 나열하고 마지막에 소그룹 미지정자.
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
		const members = registry.worshipRoster().map((p) => ({ p, s: registry.summary(p) }));
		const byName = (a: { p: { name: string } }, b: { p: { name: string } }) => a.p.name.localeCompare(b.p.name, 'ko');
		const out: Row[] = [];
		for (const c of COMMUNITY_DEFS) {
			for (const g of registry.groupsIn(c.name)) {
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
	const sumPresent = $derived(rows.filter((r) => isPresent(r.p.id)).length);

	// 전체 출석 인원: 명단 체크와 따로 입력 (방문자 등 명단 밖 인원 포함). 그 외 = 전체 - 명단 체크
	const total = $derived(registry.worshipTotal(date, sumPresent));
	const saved = $derived(registry.worshipTotalSaved(date));
	const others = $derived(Math.max(0, total - sumPresent));
	let totalInput = $state('');
	$effect(() => { totalInput = String(registry.worshipTotal(date, sumPresent)); });
	function saveTotal(e: SubmitEvent) {
		e.preventDefault();
		const n = parseInt(totalInput.replace(/\D/g, ''), 10);
		registry.setWorshipTotal(date, Number.isFinite(n) ? n : null);
	}

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

<h1>주일 오전예배 출석 등록</h1>
{#if !registry.perms.edit}
	<div class="warn">수정 권한이 꺼져 있어 출석을 등록할 수 없습니다. (최고관리자에게 수정 권한을 받아야 합니다)</div>
{/if}
<p class="muted" style="margin-top:-.6rem">주일 오전예배에 참석한 교인을 등록합니다. 명단은 공동체·소그룹 순으로 보여 줄 뿐이고,
	주일 오후 소그룹 모임 출석은 홈페이지 출석부에서 소그룹 인도자가 따로 등록합니다.</p>

<div class="card att-bar">
	<select bind:value={date} aria-label="주일 선택">{#each [...WEEKS].reverse() as d}<option value={d}>{d} ({md(d)}{dow(d)})</option>{/each}</select>
	<span class="sum">출석 <b>{sumPresent}</b> / {rows.length}명</span>
	<form class="total" onsubmit={saveTotal}>
		<label for="att-total">전체 출석 인원</label>
		<input id="att-total" bind:value={totalInput} inputmode="numeric" disabled={!registry.perms.edit} /><span>명</span>
		{#if registry.perms.edit}<button type="submit" class="sm">저장</button>{/if}
	</form>
	<span class="muted split-sum">(공동체 체크 <b>{sumPresent}</b>명 / 그 외 <b>{others}</b>명){saved === undefined ? ' · 전체 인원은 가상 샘플' : ''}</span>
	{#if total < sumPresent}<span class="warn-sm">전체 인원이 명단 체크 인원보다 적습니다.</span>{/if}
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
<p class="muted">입력한 오전예배 출석은 대시보드의 주일 출석·장기 결석 알림과 통계의 주일 출석에 바로 반영됩니다.</p>

<style>
	.att-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 0.6rem 1.1rem; }
	.att-bar select { width: auto; flex: none; }
	.sum { white-space: nowrap; }
	.sum b { color: #2f9e44; font-size: 1.1rem; }
	.total { display: flex; align-items: center; gap: 0.4rem; white-space: nowrap; }
	.total label { font-weight: 600; font-size: 0.9rem; }
	.total input { width: 5.5rem; text-align: right; }
	.split-sum { font-size: 0.88rem; }
	.split-sum b { color: var(--text); }
	.warn-sm { color: #e0245e; font-size: 0.82rem; }
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
