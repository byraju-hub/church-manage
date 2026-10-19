<script lang="ts">
	import { registry } from '#lib/registry/store.svelte.ts';
	import { ageOf } from '#lib/registry/derive.ts';

	let q = $state('');
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

	const rows = $derived(
		registry.d.people.map((p) => ({ p, s: registry.summary(p) })).filter(({ p, s }) => {
			// 쉼표로 여러 명 동시 검색
			const terms = q.split(',').map((t) => t.trim()).filter(Boolean);
			if (terms.length && !terms.some((t) => p.name.includes(t) || (p.phone ?? '').replace(/\D/g, '').includes(t.replace(/\D/g, '') || '§')))
				return false;
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
		호칭: (_, s) => s.title, 상태: (_, s) => s.status, 신급: (_, s) => s.faith, 공동체: (_, s) => s.community,
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
	{#if registry.perms.edit}<a class="btn" href="/registry/new">+ 새가족 등록</a>{/if}
</div>

<div class="card">
	<div class="toolbar">
		<input type="search" placeholder="이름·전화번호 검색 (쉼표로 여러 명 동시)" bind:value={q} onchange={runSearch} />
	</div>
	<div class="toolbar">
		<select bind:value={status}><option value="">재적상태 전체</option>{#each ['재적', '보류', '전출', '별세', '제적'] as v}<option>{v}</option>{/each}</select>
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
		<thead><tr><th>이름</th><th>호칭</th><th>상태</th><th>신급</th><th>공동체 / 소그룹</th><th>휴대폰</th><th>등록일</th><th>앱</th></tr></thead>
		<tbody>
			{#each rows as { p, s } (p.id)}
				<tr>
					<td><a href="/registry/{p.id}">{p.name}</a>{#if p.name_note}<span class="muted"> ({p.name_note})</span>{/if}</td>
					<td>{s.title || '-'}</td>
					<td><span class="badge {s.status === '재적' ? '' : s.status === '보류' ? 'inactive' : 'transferred'}">{s.status}</span></td>
					<td>{s.faith}</td>
					<td>{s.community ? `${s.community} / ${s.smallGroup}` : '-'}</td>
					<td>{p.phone ?? '-'}</td>
					<td>{s.registered ?? '미상'}</td>
					<td>{p.has_account ? '가입' : '-'}</td>
				</tr>
			{:else}
				<tr><td colspan="8" class="muted">조건에 맞는 교인이 없습니다.</td></tr>
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
