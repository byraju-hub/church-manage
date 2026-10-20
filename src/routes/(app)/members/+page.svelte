<script lang="ts">
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';
	import { ageOf } from '#lib/registry/derive.ts';
	import { EDU_DEPTS, MISSION_SOCIETIES } from '#lib/registry/types.ts';

	// 검색 방식: 기본(한 줄) / 복수(여러 명을 한꺼번에) / 항목별(칸을 골라서)
	let mode = $state<'basic' | 'multi' | 'fields'>('basic');
	const FIELDS = ['이름', '전화', '주소', '직업·직장', '메모', '인도자', '이전 교회'];
	let fieldsPicked = $state<string[]>(['이름', '전화']);
	let q = $state(page.url.searchParams.get('q') ?? '');
	let c1 = $state('');
	let c2 = $state(page.url.searchParams.get('l2') ?? '');
	let c3 = $state('');
	let eduDept = $state('');
	let society = $state('');
	let status = $state('');
	let faith = $state('');
	let office = $state('');
	let community = $state('');
	let smallGroup = $state('');
	let gender = $state('');
	let ageMin = $state('');
	let ageMax = $state('');
	let regFrom = $state('');
	let regTo = $state('');
	let account = $state('');
	let searched = $state(false);

	const digits = (x: string) => x.replace(/\D/g, '');
	// 복수 검색: 쉼표·줄바꿈으로 여러 사람을 한꺼번에
	const multiTerms = $derived(q.split(/[,\n]/).map((t) => t.trim()).filter(Boolean));
	function matchText(p: any): boolean {
		const t = q.trim();
		if (!t) return true;
		if (mode === 'multi') return multiTerms.some((x) => p.name === x || p.name.includes(x) || (digits(x).length >= 4 && digits(p.phone ?? '').includes(digits(x))));
		if (mode === 'fields') {
			const hh = registry.householdOf(p.id);
			const hay: Record<string, string> = {
				이름: `${p.name} ${p.name_note ?? ''}`, 전화: p.phone ?? '', 주소: `${p.address1 ?? ''} ${p.address2 ?? ''} ${hh?.address ?? ''}`,
				'직업·직장': `${p.occupation ?? ''} ${p.workplace ?? ''}`, 메모: p.note ?? '', 인도자: `${p.guide_name ?? ''} ${registry.person(p.guide_person_id ?? '')?.name ?? ''}`, '이전 교회': p.previous_church ?? ''
			};
			const words = t.toLowerCase().split(/\s+/);
			return words.every((w) => fieldsPicked.some((f) => hay[f].toLowerCase().includes(w) || (digits(w).length >= 4 && digits(hay[f]).includes(digits(w)))));
		}
		return p.name.includes(t) || (digits(t).length >= 4 && digits(p.phone ?? '').includes(digits(t)));
	}
	const notFound = $derived(mode === 'multi' ? multiTerms.filter((x) => !registry.d.people.some((p) => p.name === x)) : []);
	const l1opts = $derived(registry.childrenOf(null));
	const l2opts = $derived([...new Set(registry.d.categories.filter((c) => c.parent_id && registry.d.categories.find((x) => x.id === c.parent_id)?.parent_id === null && (!c1 || registry.d.categories.find((x) => x.id === c.parent_id)?.name === c1)).map((c) => c.name))]);
	const l3opts = $derived([...new Set(registry.d.categories.filter((c) => c.parent_id && registry.d.categories.find((x) => x.id === c.parent_id)?.parent_id).map((c) => c.name))]);

	const rows = $derived(
		registry.d.people.map((p) => ({ p, s: registry.summary(p) })).filter(({ p, s }) => {
			if (!matchText(p)) return false;
			if (c1 && s.cat1 !== c1) return false;
			if (c2 && s.cat2 !== c2) return false;
			if (c3 && s.cat3 !== c3) return false;
			if (eduDept && p.edu_dept !== eduDept) return false;
			if (society && p.mission_society !== society) return false;
			const age = ageOf(p.birth_date);
			return (!status || s.status === status) && (!faith || s.faith === faith) &&
				(!office || s.title === office) && (!community || s.community === community) &&
				(!smallGroup || s.smallGroup === smallGroup) && (!gender || p.gender === gender) &&
				(!ageMin || (age !== null && age >= +ageMin)) && (!ageMax || (age !== null && age <= +ageMax)) &&
				(!regFrom || (s.registered !== null && s.registered >= regFrom)) &&
				(!regTo || (s.registered !== null && s.registered <= regTo)) &&
				(!account || (account === 'y') === p.has_account);
		}).sort((a, b) => a.p.name.localeCompare(b.p.name, 'ko'))
	);

	const uniq = (xs: string[]) => [...new Set(xs.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ko'));
	const summaries = $derived(registry.d.people.map((p) => registry.summary(p)));
	const communities = $derived(uniq(registry.d.personGroups.map((g) => g.community)));
	const groups = $derived(uniq(registry.d.personGroups.filter((g) => !community || g.community === community).map((g) => g.small_group)));
	const titles = $derived(uniq(summaries.map((s) => s.title)));

	// 내려받기: 필요한 칸만 골라서 CSV
	const COLS: Record<string, (p: any, s: any) => string> = {
		이름: (p) => p.name, 동명이인구분: (p) => p.name_note ?? '', 성별: (p) => (p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : ''),
		생년월일: (p) => p.birth_date ?? '', 나이: (p) => String(ageOf(p.birth_date) ?? ''), 휴대폰: (p) => p.phone ?? '',
		주소: (p) => [p.address1, p.address2].filter(Boolean).join(' ') || registry.householdOf(p.id)?.address || '',
		호칭: (_, s) => s.title, 상태: (_, s) => s.status, 교인구분: (_, s) => s.category, 전도회: (p) => p.mission_society ?? '', 교육부서: (p) => p.edu_dept ?? '', 신급: (_, s) => s.faith, 공동체: (_, s) => s.community,
		소그룹: (_, s) => s.smallGroup, 등록일: (_, s) => s.registered ?? ''
	};
	let picked = $state<string[]>(['이름', '휴대폰', '호칭', '상태', '신급']);

	function download() {
		const head = picked.join(',');
		const body = rows.map(({ p, s }) => picked.map((c) => `"${COLS[c](p, s).replace(/"/g, '""')}"`).join(','));
		const blob = new Blob(['﻿' + [head, ...body].join('\n')], { type: 'text/csv;charset=utf-8' });
		const a = document.createElement('a');
		a.href = URL.createObjectURL(blob);
		a.download = `교인목록-${new Date().toISOString().slice(0, 10)}.csv`;
		a.click();
		registry.log('내려받기', `${rows.length}명 · ${picked.join('/')}`);
	}
	function runSearch() {
		if (!searched || q) registry.log('검색', q || '(조건 필터)');
		searched = true;
	}
</script>

<div class="row" style="justify-content:space-between">
	<h1>교인 목록 <small class="muted">({rows.length}명)</small></h1>
	{#if registry.perms.edit}<a class="btn" href="/new">+ 교인 등록</a>{/if}
</div>

<div class="card">
	<div class="toolbar">
		<input type="search" placeholder="이름·전화번호 검색 (쉼표로 여러 명 동시)" bind:value={q} onchange={runSearch} />
	</div>
	<div class="toolbar">
		<select bind:value={status}><option value="">재적상태 전체</option>{#each ['재적', '보류', '보관', '전출', '별세', '제적', '미등록'] as v}<option>{v}</option>{/each}</select>
		<select bind:value={faith}><option value="">신급 전체</option>{#each ['세례교인', '유아세례교인', '학습교인', '원입교인', '미확인'] as v}<option>{v}</option>{/each}</select>
		<select bind:value={office}><option value="">직분(호칭) 전체</option>{#each titles as v}<option>{v}</option>{/each}</select>
		<select bind:value={community} onchange={() => (smallGroup = '')}><option value="">공동체 전체</option>{#each communities as v}<option>{v}</option>{/each}</select>
		<select bind:value={smallGroup}><option value="">소그룹 전체</option>{#each groups as v}<option>{v}</option>{/each}</select>
		<select bind:value={gender}><option value="">성별 전체</option><option value="M">남</option><option value="F">여</option></select>
		<select bind:value={account}><option value="">앱 가입 전체</option><option value="y">가입</option><option value="n">미가입</option></select>
	</div>
	<div class="toolbar">
		<span class="muted">나이</span><input type="number" style="width:5rem" placeholder="이상" bind:value={ageMin} /> ~ <input type="number" style="width:5rem" placeholder="이하" bind:value={ageMax} />
		<span class="muted">등록일</span><input type="date" bind:value={regFrom} /> ~ <input type="date" bind:value={regTo} />
	</div>
</div>

<div class="card" style="padding:0;overflow-x:auto">
	<table>
		<thead><tr><th>이름</th><th>호칭</th><th>상태</th><th>교인구분</th><th>신급</th><th>공동체 / 소그룹</th><th>휴대폰</th><th>등록일</th><th>앱</th></tr></thead>
		<tbody>
			{#each rows as { p, s } (p.id)}
				<tr>
					<td><a href="/{p.id}">{p.name}</a>{#if p.name_note}<span class="muted"> ({p.name_note})</span>{/if}</td>
					<td>{s.title || '-'}</td>
					<td><span class="badge {s.status === '재적' ? '' : s.status === '보류' ? 'inactive' : 'transferred'}">{s.status}</span></td>
					<td>{s.faith}</td>
					<td>{s.community ? `${s.community} / ${s.smallGroup}` : '-'}</td>
					<td>{p.phone ?? '-'}</td>
					<td>{s.registered ?? '미상'}</td>
					<td>{p.has_account ? '가입' : '-'}</td>
				</tr>
			{:else}
				<tr><td colspan="9" class="muted">조건에 맞는 교인이 없습니다.</td></tr>
			{/each}
		</tbody>
	</table>
</div>

{#if registry.perms.export}
	<div class="card">
		<h2>내려받기 <span class="muted" style="font-weight:400">— 필요한 칸만 골라 엑셀(CSV)로 · 용도를 적어야 함(실제 시스템)</span></h2>
		<div class="cols">
			{#each Object.keys(COLS) as c}<label><input type="checkbox" value={c} bind:group={picked} />{c}</label>{/each}
		</div>
		<p><button onclick={download} disabled={!picked.length}>현재 목록 {rows.length}명 내려받기</button></p>
	</div>
{:else}
	<p class="muted">내려받기 권한이 꺼져 있습니다. (위 '내 교적 권한'에서 켜 볼 수 있습니다)</p>
{/if}
