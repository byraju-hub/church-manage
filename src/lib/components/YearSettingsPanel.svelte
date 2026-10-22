<script lang="ts">
	// 관리자 › 설정 › 연간 설정: 해마다 새로 정하는 기준을 한곳에서
	import { registry } from '#lib/registry/store.svelte.ts';
	import { AGE_MODES, GRADE_OPTIONS, bornText, gradeLabel, type BornRange, type YearSettings } from '#lib/registry/year-settings.ts';

	const thisYear = new Date().getFullYear();
	let year = $state(thisYear);
	let s = $state<YearSettings>(structuredClone(registry.settingsFor(thisYear)));
	let msg = $state('');
	// 연도를 바꾸면 그 해 설정을 불러옴
	function load(y: number) { year = y; s = structuredClone($state.snapshot(registry.settingsFor(y))) as YearSettings; msg = ''; }
	function copyPrev() {
		const prev = structuredClone($state.snapshot(registry.settingsFor(year - 1))) as YearSettings;
		// 전도회·교육부서는 한 해 지나면 출생 연도를 한 해씩 뒤로 (같은 나이대 유지)
		for (const r of Object.values(prev.societies)) { if (r.from > 1900) r.from++; if (r.to < 2100) r.to++; }
		s = { ...prev, year, promoteDate: `${year}${prev.promoteDate.slice(4)}` };
		msg = `${year - 1}년 설정을 가져왔습니다. 전도회 출생 연도는 한 해씩 옮겼습니다. 확인 후 저장해 주세요.`;
	}
	const canEdit = $derived(registry.isSuper || registry.perms.admin);
	function save() { registry.saveYearSettings(s); msg = `${year}년 연간 설정을 저장했습니다.`; }

	// 출생 연도 칸: 1900 = '이전', 2100 = '이후' (비워 두면 끝이 없음)
	const fromVal = (r: BornRange) => (r.from <= 1900 ? '' : String(r.from));
	const toVal = (r: BornRange) => (r.to >= 2100 ? '' : String(r.to));
	const setFrom = (r: BornRange, v: string) => (r.from = v.trim() ? +v : 1900);
	const setTo = (r: BornRange, v: string) => (r.to = v.trim() ? +v : 2100);

	const commMis = $derived(registry.communityMismatch(s));
	const socMis = $derived(registry.societyMismatch(s));
	const moves = $derived(registry.eduMoves(s));
	let showComm = $state(false), showSoc = $state(false), showMove = $state(true);
	function applyMoves() {
		if (!moves.length || !confirm(`${moves.length}명의 교육부서를 기준에 맞게 옮깁니다.\n교인구분(2단계)과 교육부서가 함께 바뀌고 변경 이력에 남습니다. 계속할까요?`)) return;
		const n = registry.applyEduMoves(moves);
		msg = `${n}명의 교육부서를 옮겼습니다.`;
	}
	const sample = '1990-05-01';
	const exAge = (mode: string) => { const y = 1990, now = new Date(); if (mode === '연 나이') return now.getFullYear() - y; if (mode === '한국 나이') return now.getFullYear() - y + 1; return now.getFullYear() - y - (now < new Date(now.getFullYear(), 4, 1) ? 1 : 0); };
	const males = $derived(Object.keys(s.societies).filter((k) => k.includes('남')));
	const females = $derived(Object.keys(s.societies).filter((k) => k.includes('여')));
</script>

<div class="card ys-top">
	<div class="row" style="justify-content:space-between">
		<div class="row">
			<h2 style="margin:0">연간 설정</h2>
			<select value={year} onchange={(e) => load(+e.currentTarget.value)} style="width:auto">{#each [thisYear - 1, thisYear, thisYear + 1] as y}<option value={y}>{y}년</option>{/each}</select>
			<button type="button" class="ghost sm" onclick={copyPrev} disabled={!canEdit}>{year - 1}년 설정 가져오기</button>
		</div>
		<button type="button" onclick={save} disabled={!canEdit}>{year}년 설정 저장</button>
	</div>
	<p class="muted" style="margin:.5rem 0 0;font-size:.85rem">해마다 새로 정하는 기준입니다. 새해가 되면 지난해 설정을 가져와 고친 뒤 저장하세요. {registry.d.yearSettings?.[year] ? '' : '(아직 저장한 적이 없어 기본값을 보여 줍니다)'}</p>
	{#if msg}<p class="ok" style="margin:.6rem 0 0">{msg}</p>{/if}
	{#if !canEdit}<p class="warn" style="margin:.6rem 0 0">연간 설정은 최고관리자·사이트 관리자만 바꿀 수 있습니다.</p>{/if}
</div>

<div class="dash-grid even">
	<section class="card">
		<h2>올해 표어 · 말씀</h2>
		<div class="form">
			<label class="wide">표어<input bind:value={s.motto} placeholder="예: 소그룹과 함께 마음을 같이하는 교회" /></label>
			<label class="wide">말씀<input bind:value={s.verse} placeholder="예: 행 2:46" /></label>
		</div>
		<p class="muted" style="font-size:.8rem;margin:.5rem 0 0">대시보드 위쪽 배너에 함께 나옵니다.</p>
	</section>
	<section class="card">
		<h2>나이 계산 방식</h2>
		{#each AGE_MODES as a}
			<label class="age-opt" class:on={s.ageMode === a.mode}>
				<input type="radio" name="agemode" value={a.mode} bind:group={s.ageMode} />
				<span><b>{a.mode}</b><small>{a.desc} · 예) {sample}생 → {a.mode === '만 나이' ? '만 ' : ''}{exAge(a.mode)}세</small></span>
			</label>
		{/each}
		<p class="muted" style="font-size:.8rem;margin:.5rem 0 0">교인 목록 · 교적 카드 · 검색 · 문서 등 나이가 나오는 모든 화면에 적용됩니다.</p>
	</section>
</div>

<section class="card">
	<div class="card-head"><h2>공동체별 출생 연도</h2><span class="sub">비워 두면 '이전' / '이후'로 끝이 없습니다</span></div>
	<table class="sm ys-t">
		<thead><tr><th>공동체</th><th>출생 연도 (부터)</th><th>(까지)</th><th>표시</th></tr></thead>
		<tbody>
			{#each Object.keys(s.communities) as k}
				{@const r = s.communities[k]}
				<tr><td><b>{k}</b></td>
					<td><input inputmode="numeric" value={fromVal(r)} onchange={(e) => setFrom(r, e.currentTarget.value)} placeholder="이전" /></td>
					<td><input inputmode="numeric" value={toVal(r)} onchange={(e) => setTo(r, e.currentTarget.value)} placeholder="이후" /></td>
					<td><span class="tag">{bornText(r)}</span></td></tr>
			{/each}
		</tbody>
	</table>
	<p class="chk-line">{#if commMis.length}<button type="button" class="linkish" onclick={() => (showComm = !showComm)}>기준과 맞지 않는 공동체 소속 {commMis.length}명 {showComm ? '접기' : '보기'}</button>{:else}<span class="muted">모든 공동체 소속이 기준에 맞습니다.</span>{/if}</p>
	{#if showComm && commMis.length}<p class="mis">{#each commMis as { p, s: x }, i}{i ? ', ' : ''}<a href="/{p.id}">{p.name}</a> <small class="muted">({p.birth_date?.slice(0, 4)} · {x.community.replace(' 공동체', '')})</small>{/each}</p>{/if}
</section>

<section class="card">
	<div class="card-head"><h2>전도회별 출생 연도</h2><span class="sub">남전도회 {males.length}개 · 여전도회 {females.length}개</span></div>
	<div class="soc-grid">
		{#each [males, females] as list}
			<table class="sm ys-t">
				<thead><tr><th>전도회</th><th>부터</th><th>까지</th><th>표시</th></tr></thead>
				<tbody>
					{#each list as k}
						{@const r = s.societies[k]}
						<tr><td><b>{k}</b></td>
							<td><input inputmode="numeric" value={fromVal(r)} onchange={(e) => setFrom(r, e.currentTarget.value)} placeholder="이전" /></td>
							<td><input inputmode="numeric" value={toVal(r)} onchange={(e) => setTo(r, e.currentTarget.value)} placeholder="이후" /></td>
							<td class="muted" style="font-size:.8rem">{bornText(r)}</td></tr>
					{/each}
				</tbody>
			</table>
		{/each}
	</div>
	<p class="chk-line">{#if socMis.length}<button type="button" class="linkish" onclick={() => (showSoc = !showSoc)}>기준과 맞지 않는 전도회 소속 {socMis.length}명 {showSoc ? '접기' : '보기'}</button>{:else}<span class="muted">모든 전도회 소속이 기준에 맞습니다.</span>{/if}</p>
	{#if showSoc && socMis.length}<p class="mis">{#each socMis as p, i}{i ? ', ' : ''}<a href="/{p.id}">{p.name}</a> <small class="muted">({p.birth_date?.slice(0, 4)} · {p.mission_society})</small>{/each}</p>{/if}
</section>

<section class="card">
	<div class="card-head"><h2>교육부서 학년 기준 · 부서 이동</h2><span class="sub">학년은 '올해 - 출생 연도'로 셉니다 (7 = 초1, 13 = 중1, 16 = 고1)</span></div>
	<div class="row" style="margin-bottom:.6rem"><span class="muted">진급(부서 이동) 날짜</span><input type="date" bind:value={s.promoteDate} style="width:auto" /></div>
	<table class="sm ys-t">
		<thead><tr><th>부서</th><th>시작 학년</th><th>끝 학년</th><th>{year}년 출생 연도</th></tr></thead>
		<tbody>
			{#each s.edu as e}
				<tr><td><b>{e.dept}</b></td>
					<td><select bind:value={e.from}>{#each GRADE_OPTIONS as g}<option value={g}>{gradeLabel(g)}</option>{/each}</select></td>
					<td>{#if e.dept === '장년'}<span class="muted">이후 모두</span>{:else}<select bind:value={e.to}>{#each GRADE_OPTIONS as g}<option value={g}>{gradeLabel(g)}</option>{/each}</select>{/if}</td>
					<td class="muted" style="font-size:.82rem">{year - e.to < 1900 || e.dept === '장년' ? `${year - e.from}년 이전` : `${year - e.to}~${year - e.from}년`}</td></tr>
			{/each}
		</tbody>
	</table>
	<div class="move-box">
		<div class="row" style="justify-content:space-between">
			<b>이 기준으로 부서를 옮겨야 할 교인 {moves.length}명</b>
			<div class="row">
				{#if moves.length}<button type="button" class="ghost sm" onclick={() => (showMove = !showMove)}>{showMove ? '목록 접기' : '목록 보기'}</button>{/if}
				<button type="button" class="sm" disabled={!moves.length || !canEdit} onclick={applyMoves}>{moves.length}명 부서 이동</button>
			</div>
		</div>
		{#if showMove && moves.length}
			<table class="sm" style="margin-top:.5rem">
				<thead><tr><th>이름</th><th>생년월일</th><th>학년</th><th>지금</th><th></th><th>옮길 부서</th></tr></thead>
				<tbody>
					{#each moves.slice(0, 60) as m (m.p.id)}
						<tr><td><a href="/{m.p.id}">{m.p.name}</a></td><td>{m.p.birth_date}</td><td>{gradeLabel(year - +m.p.birth_date!.slice(0, 4))}</td><td>{m.from}</td><td>→</td><td><b>{m.to}</b></td></tr>
					{/each}
				</tbody>
			</table>
			{#if moves.length > 60}<p class="muted" style="font-size:.8rem">외 {moves.length - 60}명</p>{/if}
		{/if}
		<p class="muted" style="font-size:.8rem;margin:.5rem 0 0">진급 날짜가 되면 한 번 눌러 주세요. 교인구분 2단계(예: 유초등부 → 중고등부)와 교육부서가 함께 바뀌고, 출석 상태(예배출석·가끔출석 등)는 그대로 둡니다. 청년부 기준을 넘으면 장년으로 옮깁니다.</p>
	</div>
</section>

<section class="card">
	<h2>알림 기준</h2>
	<div class="form">
		<label>장기 결석 알림 <span class="hint">(몇 주 이상 결석)</span><input type="number" min="2" max="52" bind:value={s.absentWeeks} /></label>
		<label>새가족으로 보는 기간 <span class="hint">(등록 후 며칠)</span><input type="number" min="7" max="365" bind:value={s.newcomerDays} /></label>
	</div>
	<p class="muted" style="font-size:.8rem;margin:.5rem 0 0">대시보드의 장기 결석 알림 · 새가족 목록에 쓰입니다.</p>
</section>

<div class="row" style="justify-content:flex-end;margin-bottom:1rem"><button type="button" onclick={save} disabled={!canEdit}>{year}년 설정 저장</button></div>

<style>
	.ys-t input, .ys-t select { width: 7.5rem; padding: 0.3rem 0.5rem; }
	.ys-t select { padding-right: 1.9rem; }
	.soc-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; align-items: start; }
	@media (max-width: 900px) { .soc-grid { grid-template-columns: 1fr; } }
	.age-opt { display: flex; gap: 0.6rem; align-items: flex-start; padding: 0.55rem 0.7rem; border: 1px solid var(--line); border-radius: 10px; margin-bottom: 0.4rem; cursor: pointer; }
	.age-opt.on { border-color: var(--primary); background: var(--primary-50); }
	.age-opt input { width: auto; margin-top: 0.25rem; }
	.age-opt small { display: block; color: var(--muted); font-size: 0.8rem; }
	.chk-line { margin: 0.6rem 0 0; font-size: 0.86rem; }
	.mis { margin: 0.4rem 0 0; font-size: 0.85rem; line-height: 1.8; padding: 0.6rem 0.8rem; background: var(--orange-50); border-radius: 10px; }
	.move-box { margin-top: 0.8rem; padding: 0.8rem 0.9rem; border-radius: 12px; background: var(--primary-50); }
</style>
