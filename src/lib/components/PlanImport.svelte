<script lang="ts">
	// 캘린더: 교회 연간 계획 엑셀을 올려 교회 절기 · 사역 일정 · 성례 일정을 한꺼번에 등록
	import { registry } from '#lib/registry/store.svelte.ts';
	import { KIND_COLOR } from '#lib/registry/calendar.ts';
	import { guessYear, parsePlan, SACRAMENT_WORDS, SEASON_WORDS, type PlanKind, type PlanRow } from '#lib/registry/plan-import.ts';

	let { onclose, ondone }: { onclose: () => void; ondone: (firstDate: string | null) => void } = $props();
	const KINDS: PlanKind[] = ['교회 절기', '사역 일정', '성례 일정'];
	const thisYear = new Date().getFullYear();
	let year = $state(thisYear);
	let fileName = $state('');
	let sheets = $state<{ sheet: string; data: unknown[][] }[] | null>(null);
	let rows = $state<(PlanRow & { on: boolean; dup: boolean })[]>([]);
	let err = $state('');
	let holidays = $state(0);
	let busy = $state(false);

	const exists = (r: PlanRow) => registry.d.events.some((e) => e.date === r.date && e.title.replace(/\s+/g, '') === r.title.replace(/\s+/g, ''));
	function build() {
		if (!sheets) return;
		const res = parsePlan(sheets, year);
		holidays = res.holidays;
		rows = res.rows.map((r) => { const dup = exists(r); return { ...r, on: !dup, dup }; });
		err = rows.length ? '' : '일정을 찾지 못했습니다. 날짜 칸과 일정(행사) 칸이 있는지 확인해 주세요.';
	}
	async function pick(e: Event) {
		const f = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!f) return;
		fileName = f.name;
		busy = true; err = '';
		try {
			const readExcelFile = (await import('read-excel-file/browser')).default;
			sheets = (await readExcelFile(f)) as { sheet: string; data: unknown[][] }[];
			// 문서 제목(예: '2026 교회 연중행사 계획안')이나 파일 이름에 연도가 있으면 그 연도로
			const y = guessYear(sheets) ?? +(f.name.match(/(?:^|\D)(20\d{2})(?:\D|$)/)?.[1] ?? 0);
			if (y) year = y;
			build();
		} catch (x) {
			console.error('연간 계획 읽기 실패', x);
			sheets = null; rows = [];
			err = '엑셀 파일(.xlsx)을 읽지 못했습니다. 다른 이름으로 저장 › Excel 통합 문서(.xlsx)로 저장한 뒤 다시 올려 주세요.';
		} finally {
			busy = false;
		}
	}
	const chosen = $derived(rows.filter((r) => r.on));
	const count = (k: PlanKind) => chosen.filter((r) => r.kind === k).length;
	function save() {
		if (!chosen.length) return;
		registry.addEvents(chosen.map(({ kind, date, end_date, title, note }) => ({ kind, date, end_date, title, note, person_id: null })));
		ondone([...chosen].sort((a, b) => a.date.localeCompare(b.date))[0]?.date ?? null);
	}
	// 양식 내려받기: 날짜 · 끝나는 날 · 일정 · 비고
	async function template() {
		const { default: writeXlsxFile } = await import('write-excel-file/browser');
		const head = ['날짜', '끝나는 날', '일정', '비고'].map((value) => ({ value, fontWeight: 'bold' as const, backgroundColor: '#E0E4F4' }));
		const ex: [string, string, string, string][] = [
			[`${year}-01-04`, '', '신년주일', ''],
			[`${year}-03-29`, '', '종려주일', ''],
			[`${year}-03-30`, `${year}-04-04`, '고난주간 특별새벽기도회', '본당'],
			[`${year}-04-05`, '', '부활주일 세례식 · 성찬식', ''],
			[`${year}-05-23`, `${year}-05-24`, '전교인 수련회', '수양관']
		];
		const data = [head, ...ex.map((r) => r.map((value) => ({ value })))];
		await writeXlsxFile(data, { sheet: '연간 계획', columns: [{ width: 14 }, { width: 14 }, { width: 30 }, { width: 16 }] }).toFile(`교회 연간 계획 양식-${year}.xlsx`);
	}
</script>

<div class="cal-detail plan">
	<div class="row" style="justify-content:space-between">
		<b>엑셀로 연간 계획 올리기</b>
		<button type="button" class="ghost sm" onclick={onclose}>닫기</button>
	</div>
	<div class="row" style="margin-top:.6rem">
		<label class="btn ghost sm file-btn">
			<input type="file" accept=".xlsx" onchange={pick} />엑셀 파일 고르기
		</label>
		<span class="muted" style="font-size:.85rem">{busy ? '읽는 중…' : fileName || '선택한 파일 없음'}</span>
		<label class="row" style="gap:.35rem;font-size:.85rem;margin-left:auto">연도
			<select bind:value={year} onchange={build} style="width:auto;padding:.3rem 2rem .3rem .6rem">
				{#each [thisYear - 1, thisYear, thisYear + 1, thisYear + 2] as y}<option value={y}>{y}년</option>{/each}
			</select>
		</label>
		<button type="button" class="ghost sm" onclick={template}>양식 받기</button>
	</div>
	<ul class="rule">
		<li><i class="dot" style="background:{KIND_COLOR['성례 일정']}"></i><b>성례 일정</b> — 이름에 {SACRAMENT_WORDS.join(' · ')}</li>
		<li><i class="dot" style="background:{KIND_COLOR['교회 절기']}"></i><b>교회 절기</b> — {SEASON_WORDS.join(' · ')}</li>
		<li><i class="dot" style="background:{KIND_COLOR['사역 일정']}"></i><b>사역 일정</b> — 그 밖의 모든 일정 (어린이주일 · 부부주일 같은 특별 주일 포함)</li>
		<li><i class="dot" style="background:{KIND_COLOR['공휴일']}"></i><b>공휴일</b> — 캘린더에 이미 빨간색으로 들어 있어 올리지 않음</li>
	</ul>
	<p class="muted" style="font-size:.8rem;margin:.3rem 0 0">
		첫 줄에 '날짜' · '일정(행사)' 칸 이름이 있으면 가장 정확합니다. '월' · '일' 칸으로 나뉜 표, '4/13~4/19' 같은 기간도 읽습니다. 날짜에 연도가 없으면 위의 연도로 넣습니다.
	</p>
	{#if err}<p class="warn" style="margin:.6rem 0 0">{err}</p>{/if}

	{#if rows.length}
		<div class="row" style="margin:.7rem 0 .4rem;font-size:.85rem">
			<b>{rows.length}건을 찾았습니다.</b>
			{#each KINDS as k}<span class="muted"><i class="dot" style="background:{KIND_COLOR[k]}"></i> {k} {count(k)}</span>{/each}
			{#if holidays}<span class="muted">· 공휴일 {holidays}건은 캘린더에 이미 있어 뺐습니다</span>{/if}
			{#if rows.some((r) => r.dup)}<span class="muted">· 이미 있는 일정 {rows.filter((r) => r.dup).length}건은 빼 두었습니다</span>{/if}
		</div>
		<div class="plan-list">
			<table class="sm">
				<thead><tr><th><input type="checkbox" checked={rows.every((r) => r.on)} onchange={(e) => rows.forEach((r) => (r.on = e.currentTarget.checked))} aria-label="모두 고르기" /></th><th>날짜</th><th>일정</th><th>종류</th><th>비고</th></tr></thead>
				<tbody>
					{#each rows as r}
						<tr class:off={!r.on}>
							<td><input type="checkbox" bind:checked={r.on} aria-label="{r.title} 등록" /></td>
							<td class="nw">{r.date.slice(5).replace('-', '/')}{r.end_date ? ` ~ ${r.end_date.slice(5).replace('-', '/')}` : ''}</td>
							<td>{r.title}{#if r.dup} <span class="tag">이미 있음</span>{/if}</td>
							<td><select bind:value={r.kind} style="--c:{KIND_COLOR[r.kind]}" class="kind">{#each KINDS as k}<option>{k}</option>{/each}</select></td>
							<td class="muted">{r.note ?? ''}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
		<div class="row" style="margin-top:.7rem">
			<button type="button" class="sm" disabled={!chosen.length} onclick={save}>{chosen.length}건 등록</button>
			<span class="muted" style="font-size:.8rem">종류가 틀린 일정은 등록 전에 바꿀 수 있습니다.</span>
		</div>
	{/if}
</div>

<style>
	.plan { margin-top: 0.9rem; }
	.file-btn { position: relative; overflow: hidden; cursor: pointer; }
	.file-btn input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
	.rule { margin: 0.7rem 0 0; padding: 0.6rem 0.8rem; list-style: none; background: #fff; border: 1px solid var(--line); border-radius: 10px; font-size: 0.82rem; display: grid; gap: 0.25rem; }
	.rule li { display: flex; gap: 0.4rem; align-items: baseline; }
	.rule b { flex: none; white-space: nowrap; }
	.rule .dot, .row .dot { width: 8px; height: 8px; }
	.plan-list { max-height: 360px; overflow: auto; background: #fff; border: 1px solid var(--line); border-radius: 10px; }
	.plan-list thead th { position: sticky; top: 0; z-index: 1; }
	.plan-list td.nw { white-space: nowrap; }
	tr.off td { opacity: 0.45; }
	select.kind { width: auto; padding: 0.25rem 1.9rem 0.25rem 0.55rem; font-size: 0.82rem; border-left: 4px solid var(--c); }
</style>
