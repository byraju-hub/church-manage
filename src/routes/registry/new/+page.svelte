<script lang="ts">
	import { goto } from '$app/navigation';
	import { registry } from '#lib/registry/store.svelte.ts';
	import { CONSENT_KINDS, type ConsentKind, type ConsentMethod, type Person } from '#lib/registry/types.ts';

	const today = new Date().toISOString().slice(0, 10);
	let f = $state({
		name: '', name_note: '', phone: '', gender: '' as '' | 'M' | 'F', birth_date: '', birth_lunar: false,
		address_zip: '', address1: '', address2: '', occupation: '', workplace: '',
		marital_status: '', previous_church: '', guide_person_id: '', guide_name: '', faith_checked_on: '', note: ''
	});
	let regDate = $state(today);
	let consents = $state<ConsentKind[]>(['교적 등록']);
	let method = $state<ConsentMethod>('서면');
	let ignoreDup = $state(false);

	const dups = $derived(f.name || f.phone ? registry.findDuplicates(f.name.trim(), f.phone) : []);
	const nn = (x: string) => (x.trim() === '' ? null : x.trim());
	const blocked = $derived(dups.length > 0 && !ignoreDup);

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const person: Omit<Person, 'id'> = {
			name: f.name.trim(), name_note: nn(f.name_note), phone: nn(f.phone), gender: f.gender || null,
			birth_date: nn(f.birth_date), email: null, has_account: false, birth_lunar: f.birth_lunar, reg_no: null,
			address_zip: nn(f.address_zip), address1: nn(f.address1), address2: nn(f.address2),
			occupation: nn(f.occupation), workplace: nn(f.workplace), marital_status: (nn(f.marital_status) as Person['marital_status']),
			wedding_date: null, previous_church: nn(f.previous_church),
			guide_person_id: nn(f.guide_person_id), guide_name: f.guide_person_id ? null : nn(f.guide_name),
			sms_opt_out: false, faith_checked_on: nn(f.faith_checked_on), note: nn(f.note), purged_on: null
		};
		const id = registry.createPerson(person, nn(regDate), consents, method);
		goto(`/registry/${id}`);
	}
</script>

<h1>새가족 등록</h1>
{#if !registry.perms.edit}
	<div class="warn">수정 권한이 꺼져 있어 등록할 수 없습니다. (위 '내 교적 권한'에서 '수정'을 켜 보세요)</div>
{:else}
	<p class="muted">등록카드 순서대로 입력합니다. 같은 이름·전화가 있으면 먼저 보여 줍니다.</p>
	<form class="form card" onsubmit={submit}>
		<h2 class="wide">1. 기본 정보</h2>
		<label>이름 *<input required bind:value={f.name} /></label>
		<label>휴대폰<input bind:value={f.phone} placeholder="010-0000-0000" /></label>
		{#if dups.length}
			<div class="wide warn">
				<b>같은 이름 또는 전화번호의 교인이 이미 있습니다.</b>
				<ul>{#each dups as d}<li><a href="/registry/{d.id}" target="_blank">{d.name}</a>{d.name_note ? ` (${d.name_note})` : ''} · {d.phone ?? '전화 없음'}</li>{/each}</ul>
				<label style="flex-direction:row;gap:.4rem"><input type="checkbox" style="width:auto" bind:checked={ignoreDup} />다른 사람입니다. 계속 등록 (동명이인이면 아래 '동명이인 구분'을 적어 주세요)</label>
			</div>
		{/if}
		<label>동명이인 구분<input bind:value={f.name_note} placeholder="1975년생, 2소그룹" /></label>
		<label>성별<select bind:value={f.gender}><option value="">-</option><option value="M">남</option><option value="F">여</option></select></label>
		<label>생년월일<input type="date" bind:value={f.birth_date} /></label>
		<label>음력 여부<select bind:value={f.birth_lunar}><option value={false}>양력</option><option value={true}>음력</option></select></label>

		<h2 class="wide">2. 주소·직업</h2>
		<label>우편번호<input bind:value={f.address_zip} /></label>
		<label>주소<input bind:value={f.address1} placeholder="비우면 세대 주소 사용" /></label>
		<label>상세주소<input bind:value={f.address2} /></label>
		<label>직업<input bind:value={f.occupation} /></label>
		<label>직장<input bind:value={f.workplace} /></label>
		<label>결혼 여부<select bind:value={f.marital_status}><option value="">-</option>{#each ['미혼', '기혼', '사별', '기타'] as m}<option>{m}</option>{/each}</select></label>

		<h2 class="wide">3. 신앙·이전 교회·인도자</h2>
		<label>등록일<input type="date" bind:value={regDate} /></label>
		<label>이전 교회<input bind:value={f.previous_church} /></label>
		<label>신급 확인일<input type="date" bind:value={f.faith_checked_on} /></label>
		<label>인도자(교인)
			<select bind:value={f.guide_person_id}><option value="">교인 아님 / 없음</option>{#each registry.d.people as p}<option value={p.id}>{p.name}{p.name_note ? ` (${p.name_note})` : ''}</option>{/each}</select>
		</label>
		{#if !f.guide_person_id}<label>인도자 이름(교인 아님)<input bind:value={f.guide_name} /></label>{/if}
		<label class="wide">비고<textarea rows="2" bind:value={f.note}></textarea></label>

		<h2 class="wide">4. 개인정보 동의 <span class="muted" style="font-weight:400">(서면 동의는 담당자가 입력)</span></h2>
		<div class="wide cols">
			{#each CONSENT_KINDS as k}<label><input type="checkbox" value={k} bind:group={consents} />{k}</label>{/each}
			<label>방법<select bind:value={method} style="width:auto">{#each ['서면', '앱', '구두'] as m}<option>{m}</option>{/each}</select></label>
		</div>

		<div class="wide row"><button type="submit" disabled={!f.name.trim() || blocked}>등록</button><a class="btn ghost" href="/registry">취소</a></div>
	</form>
{/if}
