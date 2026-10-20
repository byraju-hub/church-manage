<script lang="ts">
	import { goto } from '$app/navigation';
	import { registry } from '#lib/registry/store.svelte.ts';
	import PersonFields from '#lib/components/PersonFields.svelte';
	import PersonPicker from '#lib/components/PersonPicker.svelte';
	import { categoryPath } from '#lib/registry/derive.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';
	import {
		CONSENT_KINDS, FAITH_KINDS, OFFICE_NAMES, OFFICE_STATUS_OPTIONS, ORDAINED, RELATIONS,
		type ConsentKind, type ConsentMethod, type FaithKind, type OfficeName, type OfficeStatus, type Person
	} from '#lib/registry/types.ts';

	const today = new Date().toISOString().slice(0, 10);
	let f = $state<Record<string, any>>({
		name: '', name_note: '', phone: '', gender: '', birth_date: '', birth_lunar: false, sms_opt_out: false, email: '', photo: '',
		address_zip: '', address1: '', address2: '', occupation: '', workplace: '', marital_status: '', wedding_date: '',
		previous_church: '', guide_person_id: '', guide_name: '', note: '', category_id: 'm.n.a', edu_dept: '', mission_society: '',
		clergy_title: '', big_family_head_id: '', big_family_relation: ''
	});
	let regDate = $state(today);
	// 세대
	let hhMode = $state<'new' | 'join'>('new');
	let hhWith = $state('');
	let hhRelation = $state('자녀');
	// 신급 · 직분
	let faith = $state<{ kind: FaithKind | '해당사항 없음'; date: string; church: string; officiant: string }>({ kind: '해당사항 없음', date: '', church: '', officiant: '' });
	let office = $state<{ name: OfficeName | '성도'; status: OfficeStatus; date: string; church: string }>({ name: '성도', status: '시무', date: '', church: '' });
	let services = $state<string[]>([]);
	let community = $state('');
	let smallGroup = $state('');
	// 동의
	let consents = $state<ConsentKind[]>(['교적 등록']);
	let method = $state<ConsentMethod>('서면');
	let ignoreDup = $state(false);

	const dups = $derived(f.name || f.phone ? registry.findDuplicates(f.name.trim(), f.phone) : []);
	const blocked = $derived(dups.length > 0 && !ignoreDup);
	const nn = (x: string) => (x.trim() === '' ? null : x.trim());
	const catPath = $derived(categoryPath(registry.d.categories, f.category_id || null));
	const isAdult = $derived(catPath[1]?.name === '장년');
	const statusOptions = $derived(office.name === '성도' ? [] : OFFICE_STATUS_OPTIONS[office.name]);
	const committees = $derived(registry.d.orgUnits.filter((o) => !o.parent_id).sort((a, b) => a.sort_order - b.sort_order));
	const missing = $derived([!f.photo && '사진', faith.kind === '해당사항 없음' && '신급', office.name === '성도' && '직분'].filter(Boolean) as string[]);

	$effect(() => { if (office.name !== '성도' && !OFFICE_STATUS_OPTIONS[office.name].includes(office.status)) office.status = OFFICE_STATUS_OPTIONS[office.name][0]; });

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const person: Omit<Person, 'id'> = {
			name: f.name.trim(), name_note: nn(f.name_note), phone: nn(f.phone), gender: f.gender || null,
			birth_date: nn(f.birth_date), email: nn(f.email), has_account: false, birth_lunar: f.birth_lunar, reg_no: null,
			address_zip: nn(f.address_zip), address1: nn(f.address1), address2: nn(f.address2),
			occupation: nn(f.occupation), workplace: nn(f.workplace), marital_status: (nn(f.marital_status) as Person['marital_status']),
			wedding_date: nn(f.wedding_date), previous_church: nn(f.previous_church),
			guide_person_id: nn(f.guide_person_id), guide_name: f.guide_person_id ? null : nn(f.guide_name),
			sms_opt_out: f.sms_opt_out, faith_checked_on: null, note: nn(f.note), purged_on: null,
			photo: nn(f.photo), category_id: nn(f.category_id), clergy_title: nn(f.clergy_title) as Person['clergy_title'],
			edu_dept: nn(f.edu_dept) as Person['edu_dept'], mission_society: nn(f.mission_society),
			big_family_head_id: nn(f.big_family_head_id), big_family_relation: f.big_family_head_id ? nn(f.big_family_relation) : null
		};
		const id = registry.createPerson(person, nn(regDate), consents, method);
		// 세대
		const target = hhMode === 'join' && hhWith ? registry.householdOf(hhWith) : undefined;
		if (target) registry.assignToHousehold(id, target.id, hhRelation);
		else { const h = registry.createHousehold(person.address1); registry.assignToHousehold(id, h.id, '본인'); }
		// 신급
		if (faith.kind !== '해당사항 없음') registry.addFaith({ person_id: id, kind: faith.kind, event_date: nn(faith.date), church: nn(faith.church), officiant: nn(faith.officiant), note: null });
		else registry.updatePerson(id, { faith_checked_on: regDate });
		// 직분 · 임직
		if (office.name !== '성도') {
			const ordained = ORDAINED.includes(office.name);
			registry.addOffice({ person_id: id, office: office.name, rank_status: office.status, start_date: ordained ? nn(office.date) : null, end_date: null, church: ordained ? nn(office.church) : null, note: null });
		}
		for (const org of services) registry.addAffiliation({ person_id: id, org, role: null, start_date: regDate, end_date: null });
		if (isAdult && community && smallGroup) registry.setGroup(id, community, smallGroup);
		goto(`/${id}`);
	}
</script>

<h1>교인 등록</h1>
{#if !registry.perms.edit}
	<div class="warn">수정 권한이 꺼져 있어 등록할 수 없습니다. (상단 '권한 시험'에서 '수정'을 켜 보세요)</div>
{:else}
	<p class="muted">등록카드 순서대로 입력합니다. <b>*</b> 표시는 필수 항목입니다. 같은 이름·전화가 있으면 먼저 보여 줍니다.</p>
	<form class="form card" onsubmit={submit}>
		<PersonFields bind:f />

		{#if dups.length}
			<div class="wide warn">
				<b>같은 이름 또는 전화번호의 교인이 이미 있습니다.</b>
				<ul>{#each dups as d}<li><a href="/{d.id}" target="_blank">{d.name}</a>{d.name_note ? ` (${d.name_note})` : ''} · {d.phone ?? '전화 없음'}</li>{/each}</ul>
				<label style="flex-direction:row;gap:.4rem"><input type="checkbox" style="width:auto" bind:checked={ignoreDup} />다른 사람입니다. 계속 등록 (동명이인이면 위 '동명이인 구분'을 적어 주세요)</label>
			</div>
		{/if}

		<h2 class="wide">5. 세대주 · 관계 *</h2>
		<div class="wide cols">
			<label><input type="radio" bind:group={hhMode} value="new" />새 세대 (이 사람이 세대주)</label>
			<label><input type="radio" bind:group={hhMode} value="join" />이미 있는 세대에 추가</label>
		</div>
		{#if hhMode === 'join'}
			<label class="wide">같은 세대의 교인<PersonPicker bind:value={hhWith} placeholder="가족 중 한 분의 이름 검색" /></label>
			<label>세대주와의 관계<select bind:value={hhRelation}>{#each RELATIONS.filter((r) => r !== '본인') as r}<option>{r}</option>{/each}</select></label>
			{#if hhWith && !registry.householdOf(hhWith)}<div class="wide warn">그 교인은 아직 세대가 없어 새 세대로 등록됩니다.</div>{/if}
		{/if}

		<h2 class="wide">6. 신급 *</h2>
		<label>신급<select bind:value={faith.kind}><option>해당사항 없음</option>{#each FAITH_KINDS as k}<option>{k}</option>{/each}</select></label>
		{#if faith.kind !== '해당사항 없음'}
			<label>신급일<input type="date" bind:value={faith.date} /></label>
			<label>신급교회<input bind:value={faith.church} placeholder="비우면 본 교회" /></label>
			<label>집례자<input bind:value={faith.officiant} /></label>
		{/if}

		<h2 class="wide">7. 직분 *</h2>
		<label>직분<select bind:value={office.name}><option>성도</option>{#each OFFICE_NAMES as o}<option>{o}</option>{/each}</select></label>
		{#if office.name !== '성도'}
			<label>신분<select bind:value={office.status}>{#each statusOptions as s}<option>{s}</option>{/each}</select></label>
			{#if ORDAINED.includes(office.name)}
				<label>임직일<input type="date" bind:value={office.date} /></label>
				<label>임직교회<input bind:value={office.church} placeholder="비우면 본 교회" /></label>
			{/if}
		{/if}

		<h2 class="wide">8. 교회 등록일 · 공동체 · 교회봉사</h2>
		<label>교회 등록일<input type="date" bind:value={regDate} /></label>
		{#if isAdult}
			<label>공동체<select bind:value={community} onchange={() => (smallGroup = '')}><option value="">선택</option>{#each COMMUNITY_DEFS as c}<option>{c.name}</option>{/each}</select></label>
			<label>소그룹<select bind:value={smallGroup} disabled={!community}><option value="">선택</option>{#each COMMUNITY_DEFS.find((c) => c.name === community)?.groups ?? [] as g}<option>{g.name}</option>{/each}</select></label>
		{:else}
			<p class="wide muted" style="margin:0">공동체·소그룹은 교인구분이 '장년'일 때 고릅니다. (청년·교육부서는 위의 '교육부서' 칸)</p>
		{/if}
		<div class="wide">
			<span class="muted" style="font-size:.82rem;font-weight:600">교회봉사 (교회 조직표의 부서, 여러 곳 선택 가능)</span>
			{#each committees as c}
				<div style="margin-top:.5rem"><b style="font-size:.88rem">{c.name}</b>
					<div class="cols" style="margin-top:.2rem">{#each registry.d.orgUnits.filter((o) => o.parent_id === c.id) as d}<label><input type="checkbox" value={d.name} bind:group={services} />{d.name}</label>{/each}</div></div>
			{/each}
		</div>

		<h2 class="wide">9. 개인정보 동의 <span class="muted" style="font-weight:400">(서면 동의는 담당자가 입력)</span></h2>
		<div class="wide cols">
			{#each CONSENT_KINDS as k}<label><input type="checkbox" value={k} bind:group={consents} />{k}</label>{/each}
			<label>방법<select bind:value={method} style="width:auto">{#each ['서면', '앱', '구두'] as m}<option>{m}</option>{/each}</select></label>
		</div>

		{#if missing.length}<div class="wide warn">필수 항목 중 아직 비어 있는 것: <b>{missing.join(' · ')}</b> (시험 중이라 그대로 등록할 수 있습니다)</div>{/if}
		<div class="wide row"><button type="submit" disabled={!f.name.trim() || blocked}>등록</button><a class="btn ghost" href="/members">취소</a></div>
	</form>
{/if}
