<script lang="ts">
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';
	import { recentSundays } from '#lib/registry/attendance.mock.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';

	const WEEKS = recentSundays(8);
	let date = $state(WEEKS[WEEKS.length - 1]);
	const weeksFromEnd = $derived(WEEKS.length - 1 - WEEKS.indexOf(date));
	const UNASSIGNED = '__none__';
	let sel = $state(page.url.searchParams.get('group') ?? COMMUNITY_DEFS[0].groups[0].name);
	let reasons = $state<Record<string, string>>({});

	const communityOf = (name: string) => COMMUNITY_DEFS.find((c) => c.groups.some((g) => g.name === name))?.name ?? '';
	const list = $derived.by(() => {
		if (sel === UNASSIGNED) {
			// 소그룹 미지정자: 재적 장년 중 소그룹이 없는 사람
			return registry.d.people
				.map((p) => ({ p, s: registry.summary(p) }))
				.filter(({ s }) => s.memberCert && !s.smallGroup && s.cat2 === '장년');
		}
		return registry.membersOfGroup(sel).map((p) => ({ p, s: registry.summary(p) })).filter(({ s }) => s.memberCert);
	});
	const rows = $derived(list.sort((a, b) => a.p.name.localeCompare(b.p.name, 'ko')));
	const present = $derived(rows.filter(({ p }) => registry.attended(p.id, date, weeksFromEnd)).length);
	const unassignedCount = $derived(registry.d.people.filter((p) => { const s = registry.summary(p); return s.memberCert && !s.smallGroup && s.cat2 === '장년'; }).length);

	function mark(pid: string, ok: boolean) {
		registry.setAttendance(date, pid, ok, (reasons[pid] ?? registry.attendanceMark(pid, date)?.reason ?? '') || null);
	}
	function reason(pid: string, text: string) {
		reasons[pid] = text;
		registry.setAttendance(date, pid, registry.attended(pid, date, weeksFromEnd), text.trim() || null);
	}
	function allPresent() { for (const { p } of rows) registry.setAttendance(date, p.id, true, registry.attendanceMark(p.id, date)?.reason ?? null); }
	const md = (iso: string) => `${+iso.slice(5, 7)}/${+iso.slice(8, 10)}`;
</script>

<h1>주일 출석 등록</h1>
{#if !registry.perms.edit}
	<div class="warn">수정 권한이 꺼져 있어 출석을 등록할 수 없습니다. (최고관리자에게 수정 권한을 받아야 합니다)</div>
{/if}
<p class="muted" style="margin-top:-.6rem">실제로는 기존 출석부에서 인도자가 직접 체크합니다. 여기서는 그 화면이 어떤 모양일지 시험해 봅니다.</p>

<div class="card">
	<div class="toolbar">
		<label class="row" style="gap:.4rem"><span class="muted">주일</span>
			<select bind:value={date}>{#each [...WEEKS].reverse() as d}<option value={d}>{d} ({md(d)})</option>{/each}</select></label>
		<label class="row" style="gap:.4rem"><span class="muted">소그룹</span>
			<select bind:value={sel}>
				{#each COMMUNITY_DEFS as c}
					<optgroup label={c.name}>{#each c.groups as g}<option value={g.name}>{g.name}{g.care ? ' (자녀 돌봄)' : ''}</option>{/each}</optgroup>
				{/each}
				<optgroup label="그 밖"><option value={UNASSIGNED}>소그룹 미지정자 ({unassignedCount}명)</option></optgroup>
			</select></label>
		<span class="muted">{sel === UNASSIGNED ? '소그룹이 없는 재적 장년' : communityOf(sel)} · 출석 <b style="color:var(--text)">{present}</b> / {rows.length}명</span>
		{#if registry.perms.edit}<button type="button" class="ghost sm" onclick={allPresent}>모두 출석</button>{/if}
	</div>
</div>

<div class="card" style="padding:0;overflow-x:auto">
	<table class="sm">
		<thead><tr><th style="width:4.5rem">출석</th><th>이름</th><th>직분</th><th>휴대폰</th><th>특이사항 · 사유</th><th></th></tr></thead>
		<tbody>
			{#each rows as { p, s } (p.id)}
				{@const ok = registry.attended(p.id, date, weeksFromEnd)}
				{@const mk = registry.attendanceMark(p.id, date)}
				<tr>
					<td><input type="checkbox" checked={ok} disabled={!registry.perms.edit} onchange={(e) => mark(p.id, e.currentTarget.checked)} aria-label="{p.name} 출석" /></td>
					<td><a href="/{p.id}">{p.name}</a></td>
					<td>{s.title || '-'}</td>
					<td>{p.phone ?? '-'}</td>
					<td style="min-width:240px"><input value={mk?.reason ?? ''} disabled={!registry.perms.edit} placeholder={ok ? '' : '결석 사유 (예: 출장, 병환)'} onchange={(e) => reason(p.id, e.currentTarget.value)} /></td>
					<td class="muted" style="font-size:.78rem;white-space:nowrap">{mk ? '입력됨' : '샘플'}</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="muted">해당 교인이 없습니다.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
<p class="muted">소그룹 미지정자는 따로 모아 한 곳에서 출석을 등록합니다. 입력한 출석은 대시보드와 통계에 바로 반영됩니다.</p>
