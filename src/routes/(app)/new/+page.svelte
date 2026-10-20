<script lang="ts">
	// 교인 등록: 등록카드 순서대로 입력 (세대·신급·직분·소속·봉사·동의까지 한 번에)
	import { goto } from '$app/navigation';
	import { registry } from '#lib/registry/store.svelte.ts';
	import PersonFields from '#lib/components/PersonFields.svelte';
	import HeadRelation from '#lib/components/HeadRelation.svelte';
	import { categoryPath } from '#lib/registry/derive.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';
	import {
		CONSENT_KINDS, FAITH_KINDS, OFFICE_STATUS_OPTIONS, ORDAINED, POSITIONS,
		type ConsentKind, type ConsentMethod, type FaithKind, type OfficeStatus, type Person
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
	let hhWith = $state('');
	let hhRelation = $state('본인');
	// 신급 · 직분
	let faith = $state<{ kind: FaithKind | '해당사항 없음'; date: string; church: string; officiant: string }>({ kind: '해당사항 없음', date: '', church: '', officiant: '' });
	let office = $state<{ pos: string; status: OfficeStatus; date: string; church: string }>({ pos: '성도', status: '시무', date: '', church: '' });
	let services = $state<string[]>(['', '', '']);
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
	const position = $derived(POSITIONS.find((x) => x.label === office.pos)!);
	const statusOptions = $derived(position.office ? OFFICE_STATUS_OPTIONS[position.office] : []);
	const committees = $derived(registry.d.orgUnits.filter((o) => !o.parent_id).sort((a, b) => a.sort_order - b.sort_order));
	const missing = $derived([!f.photo && '사진', faith.kind === '해당사항 없음' && '신급', office.pos === '성도' && '직분'].filter(Boolean) as string[]);

	$effect(() => { if (position.office && !OFFICE_STATUS_OPTIONS[position.office].includes(office.status)) office.status = OFFICE_STATUS_OPTIONS[position.office][0]; });

	// 세대주 정보 가져오기: 주소와 우편번호를 세대주 것으로 채움
	function fetchHead(id: string) {
		const h = registry.householdOf(id);
		const p = registry.person(id);
		f.address1 = p?.address1 || h?.address || f.address1;
		f.address_zip = p?.address_zip || h?.zip || f.address_zip;
		if (p?.address2) f.address2 = p.address2;
	}

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
			photo: nn(f.photo), category_id: nn(f.category_id), clergy_title: position.clergy,
			edu_dept: nn(f.edu_dept) as Person['edu_dept'], mission_society: nn(f.mission_society),
			big_family_head_id: nn(f.big_family_head_id), big_family_relation: f.big_family_head_id ? nn(f.big_family_relation) : null
		};
		const id = registry.createPerson(person, nn(regDate), consents, method);
		// 세대
		const target = hhRelation !== '본인' && hhWith ? registry.householdOf(hhWith) : undefined;
		if (target) registry.assignToHousehold(id, target.id, hhRelation);
		else { const h = registry.createHousehold(person.address1); registry.assignToHousehold(id, h.id, '본인'); }
		// 신급
		if (faith.kind !== '해당사항 없음') registry.addFaith({ person_id: id, kind: faith.kind, event_date: nn(faith.date), church: nn(faith.church), officiant: nn(faith.officiant), note: null });
		else registry.updatePerson(id, { faith_checked_on: regDate });
		// 직분 · 임직
		if (position.office) {
			const ordained = ORDAINED.includes(position.office);
			registry.addOffice({ person_id: id, office: position.office, rank_status: office.status, start_date: ordained ? nn(office.date) : null, end_date: null, church: ordained ? nn(office.church) : null, note: null });
		}
		for (const org of new Set(services.filter(Boolean))) registry.addAffiliation({ person_id: id, org, role: null, start_date: regDate, end_date: null });
		if (isAdult && community && smallGroup) registry.setGroup(id, community, smallGroup);
		goto(`/${id}`);
	}
</script>

<h1>교인 등록</h1>
{#if !registry.perms.edit}
	<div class="warn">수정 권한이 꺼져 있어 등록할 수 없습니다. (최고관리자에게 수정 권한을 받아야 합니다)</div>
{:else}
	<p class="muted">등록카드 순서대로 입력합니다. <b>*</b> 표시는 필수 항목입니다. 같은 이름·전화가 있으면 먼저 보여 줍니다.</p>
	<form class="form card" onsubmit={submit}>
		<PersonFields bind:f autoNote>
			{#snippet household()}
				<div class="sec">
					<h3>세대주 · 관계</h3>
					<HeadRelation label="신앙세대주 / 관계" required bind:headId={hhWith} bind:relation={hhRelation} onfetch={fetchHead} note="※세대주일 경우에는, 관계만 선택(본인)하시면 됩니다." />
					{#if hhRelation !== '본인' && hhWith && !registry.householdOf(hhWith)}<div class="warn" style="margin-top:.5rem">그 교인은 아직 세대가 없어 새 세대로 등록됩니다.</div>{/if}
				</div>
			{/snippet}
		</PersonFields>

		{#if dups.length}
			<div class="wide warn">
				<b>같은 이름 또는 전화번호의 교인이 이미 있습니다.</b>
				<ul>{#each dups as d}<li><a href="/{d.id}" target="_blank">{d.name}</a>{d.name_note ? ` (${d.name_note})` : ''} · {d.phone ?? '전화 없음'}</li>{/each}</ul>
				<label style="flex-direction:row;gap:.4rem"><input type="checkbox" style="width:auto" bind:checked={ignoreDup} />다른 사람입니다. 계속 등록 (동명이인이면 위 '동명이인 구분'을 골라 주세요)</label>
			</div>
		{/if}

		<div class="sec">
			<h3>신급 · 직분</h3>
			<div class="form">
				<label>신급 *<select bind:value={faith.kind}><option>해당사항 없음</option>{#each FAITH_KINDS as k}<option>{k}</option>{/each}</select></label>
				<label>신급일<input type="date" bind:value={faith.date} disabled={faith.kind === '해당사항 없음'} /></label>
				<label>신급교회<input bind:value={faith.church} placeholder="비우면 본 교회" disabled={faith.kind === '해당사항 없음'} /></label>
				<label>집례자<input bind:value={faith.officiant} disabled={faith.kind === '해당사항 없음'} /></label>
				<label>직분 * <span class="muted" style="font-weight:400">(교역자 직책 포함)</span><select bind:value={office.pos}>{#each POSITIONS as o}<option>{o.label}</option>{/each}</select></label>
				{#if position.office}
					<label>신분<select bind:value={office.status}>{#each statusOptions as s}<option>{s}</option>{/each}</select></label>
					{#if ORDAINED.includes(position.office)}
						<label>임직일<input type="date" bind:value={office.date} /></label>
						<label>임직교회<input bind:value={office.church} placeholder="비우면 본 교회" /></label>
					{/if}
				{/if}
			</div>
		</div>

		<div class="sec">
			<h3>교회 등록일 · 공동체 · 교회봉사</h3>
			<div class="form">
				<label>교회 등록일<input type="date" bind:value={regDate} /></label>
				{#if isAdult}
					<label>공동체<select bind:value={community} onchange={() => (smallGroup = '')}><option value="">선택</option>{#each COMMUNITY_DEFS as c}<option>{c.name}</option>{/each}</select></label>
					<label>소그룹<select bind:value={smallGroup} disabled={!community}><option value="">선택</option>{#each COMMUNITY_DEFS.find((c) => c.name === community)?.groups ?? [] as g}<option>{g.name}</option>{/each}</select></label>
				{:else}
					<p class="wide muted" style="margin:0">공동체·소그룹은 교인구분 2단계가 '장년'일 때 고릅니다.</p>
				{/if}
				{#each [0, 1, 2] as i}
					<label>봉사 부서 {i + 1}
						<select bind:value={services[i]}>
							<option value="">선택 안 함</option>
							{#each committees as c}
								<optgroup label={c.name}>{#each registry.d.orgUnits.filter((o) => o.parent_id === c.id) as d}<option value={d.name} disabled={services.some((x, j) => j !== i && x === d.name)}>{d.name}</option>{/each}</optgroup>
							{/each}
						</select>
					</label>
				{/each}
			</div>
		</div>

		<div class="sec">
			<h3>개인정보 동의 <span class="muted" style="font-weight:400">(서면 동의는 담당자가 입력)</span></h3>
			<div class="cols">
				{#each CONSENT_KINDS as k}<label><input type="checkbox" value={k} bind:group={consents} />{k}</label>{/each}
				<label>방법<select bind:value={method} style="width:auto">{#each ['서면', '앱', '구두'] as m}<option>{m}</option>{/each}</select></label>
			</div>
		</div>

		{#if missing.length}<div class="wide warn">필수 항목 중 아직 비어 있는 것: <b>{missing.join(' · ')}</b> (시험 중이라 그대로 등록할 수 있습니다)</div>{/if}
		<div class="wide row"><button type="submit" disabled={!f.name.trim() || blocked}>등록</button><a class="btn ghost" href="/members">취소</a></div>
	</form>
{/if}
