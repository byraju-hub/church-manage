<script lang="ts">
	import { registry } from '#lib/registry/store.svelte.ts';
	import PersonPicker from '#lib/components/PersonPicker.svelte';
	import { ageOf, categoryPath } from '#lib/registry/derive.ts';
	import { CLERGY_TITLES, EDU_DEPTS, MARITAL_STATUSES, MISSION_SOCIETIES, RELATIONS } from '#lib/registry/types.ts';

	// f: 교인 카드의 칸들(빈 칸은 빈 문자열). 등록 화면과 카드 수정 화면이 함께 씀
	let { f = $bindable(), showGuide = true }: { f: Record<string, any>; showGuide?: boolean } = $props();

	// ---- 교인구분 3단계 ----
	const initPath = categoryPath(registry.d.categories, f.category_id || null).map((c) => c.id);
	let l1 = $state(initPath[0] ?? '');
	let l2 = $state(initPath[1] ?? '');
	let l3 = $state(initPath[2] ?? '');
	const o1 = $derived(registry.childrenOf(null));
	const o2 = $derived(l1 ? registry.childrenOf(l1) : []);
	const o3 = $derived(l2 ? registry.childrenOf(l2) : []);
	function pickL1() { l2 = ''; l3 = ''; sync(); }
	function pickL2() { l3 = ''; sync(); }
	function sync() { f.category_id = l3 || l2 || l1 || ''; }

	// ---- 사진: 작게 줄여서 저장 ----
	function onPhoto(e: Event) {
		const file = (e.currentTarget as HTMLInputElement).files?.[0];
		if (!file) return;
		const img = new Image();
		img.onload = () => {
			const s = 180 / Math.max(img.width, img.height, 180);
			const c = document.createElement('canvas');
			c.width = Math.round(img.width * Math.min(1, s)); c.height = Math.round(img.height * Math.min(1, s));
			c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
			f.photo = c.toDataURL('image/jpeg', 0.75);
			URL.revokeObjectURL(img.src);
		};
		img.src = URL.createObjectURL(file);
	}

	// ---- 도로명 주소 검색 (다음 우편번호 서비스) ----
	let addrMsg = $state('');
	function searchAddress() {
		const open = () => new (window as any).daum.Postcode({
			oncomplete: (d: any) => { f.address_zip = d.zonecode; f.address1 = d.roadAddress || d.jibunAddress; }
		}).open();
		if ((window as any).daum?.Postcode) return open();
		const sc = document.createElement('script');
		sc.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
		sc.onload = open;
		sc.onerror = () => (addrMsg = '주소 검색 서비스에 연결할 수 없습니다. 직접 입력해 주세요. (인터넷 연결이 필요합니다)');
		document.head.appendChild(sc);
	}
	const age = $derived(f.birth_date ? ageOf(f.birth_date) : null);
</script>

<h2 class="wide">1. 기본 정보</h2>
<label>이름 *<input required bind:value={f.name} /></label>
<label>동명이인 구분<input bind:value={f.name_note} placeholder="1975년생" /></label>
<label>생년월일 *<input type="date" required bind:value={f.birth_date} /></label>
<label>양력 / 음력<select bind:value={f.birth_lunar}><option value={false}>양력</option><option value={true}>음력</option></select></label>
<label>나이 <span class="muted" style="font-weight:400">(생년월일로 자동 계산)</span><input value={age === null ? '' : `만 ${age}세`} readonly tabindex="-1" /></label>
<label>성별 *<select required bind:value={f.gender}><option value="">선택</option><option value="M">남</option><option value="F">여</option></select></label>
<label>휴대폰 *<input required bind:value={f.phone} placeholder="010-0000-0000" /></label>
<label>문자 수신 거부<select bind:value={f.sms_opt_out}><option value={false}>아니오</option><option value={true}>예</option></select></label>
<label>이메일<input type="email" bind:value={f.email} /></label>
<label class="photo-box">사진 *
	<span class="row" style="flex-wrap:nowrap">
		{#if f.photo}<img src={f.photo} alt="사진 미리보기" class="photo" />{:else}<span class="photo empty">없음</span>{/if}
		<input type="file" accept="image/*" onchange={onPhoto} style="padding:.35rem" />
		{#if f.photo}<button type="button" class="ghost sm" onclick={() => (f.photo = '')}>지우기</button>{/if}
	</span>
</label>

<h2 class="wide">2. 주소 · 직장 · 결혼</h2>
<label>우편번호<input bind:value={f.address_zip} /></label>
<label class="wide">주소 * <span class="muted" style="font-weight:400">(도로명 주소 검색)</span>
	<span class="row" style="flex-wrap:nowrap"><input required bind:value={f.address1} placeholder="검색 버튼을 누르거나 직접 입력" /><button type="button" class="ghost" onclick={searchAddress}>주소 검색</button></span>
	{#if addrMsg}<span class="muted" style="font-weight:400">{addrMsg}</span>{/if}
</label>
<label>상세주소<input bind:value={f.address2} /></label>
<label>직업<input bind:value={f.occupation} /></label>
<label>직장<input bind:value={f.workplace} /></label>
<label>결혼 여부<select bind:value={f.marital_status}><option value="">-</option>{#each MARITAL_STATUSES as m}<option>{m}</option>{/each}</select></label>
<label>결혼기념일<input type="date" bind:value={f.wedding_date} /></label>

<h2 class="wide">3. 교회 등록 · 인도</h2>
<label>이전 출석 교회<input bind:value={f.previous_church} /></label>
{#if showGuide}
	<label class="wide">인도자 <span class="muted" style="font-weight:400">(교인이면 검색해서 선택, 아니면 아래에 이름)</span><PersonPicker bind:value={f.guide_person_id} placeholder="인도한 교인 이름 검색" /></label>
	{#if !f.guide_person_id}<label>인도자 이름 (교인 아님)<input bind:value={f.guide_name} /></label>{/if}
{/if}
<label>대가족 세대주 <span class="muted" style="font-weight:400">(같은 집이 아닌 가족)</span><PersonPicker bind:value={f.big_family_head_id} placeholder="대가족 세대주 검색" /></label>
{#if f.big_family_head_id}
	<label>대가족 세대주와의 관계<select bind:value={f.big_family_relation}><option value="">-</option>{#each RELATIONS.filter((r) => r !== '본인') as r}<option>{r}</option>{/each}</select></label>
{/if}
<label class="wide">기타 메모<textarea rows="2" bind:value={f.note}></textarea></label>

<h2 class="wide">4. 교인구분 · 소속</h2>
<label>교인구분 (1단계)<select bind:value={l1} onchange={pickL1}><option value="">선택</option>{#each o1 as c}<option value={c.id}>{c.name}</option>{/each}</select></label>
<label>2단계<select bind:value={l2} onchange={pickL2} disabled={!o2.length}><option value="">{o2.length ? '선택' : '-'}</option>{#each o2 as c}<option value={c.id}>{c.name}</option>{/each}</select></label>
<label>3단계<select bind:value={l3} onchange={sync} disabled={!o3.length}><option value="">{o3.length ? '선택' : '-'}</option>{#each o3 as c}<option value={c.id}>{c.name}</option>{/each}</select></label>
<label>교육부서 <span class="muted" style="font-weight:400">(청년 · 교육부서인 경우)</span><select bind:value={f.edu_dept}><option value="">해당 없음</option>{#each EDU_DEPTS as d}<option>{d}</option>{/each}</select></label>
<label>전도회<select bind:value={f.mission_society}>
	<option value="">해당 없음</option>
	<optgroup label="남전도회">{#each MISSION_SOCIETIES.filter((s) => s.includes('남')) as s}<option>{s}</option>{/each}</optgroup>
	<optgroup label="여전도회">{#each MISSION_SOCIETIES.filter((s) => s.includes('여')) as s}<option>{s}</option>{/each}</optgroup>
</select></label>
<label>교역자 직책 <span class="muted" style="font-weight:400">(교역자만)</span><select bind:value={f.clergy_title}><option value="">해당 없음</option>{#each CLERGY_TITLES as t}<option>{t}</option>{/each}</select></label>

<style>
	.photo { width: 54px; height: 54px; border-radius: 12px; object-fit: cover; border: 1px solid var(--line-strong); flex: none; }
	.photo.empty { display: grid; place-items: center; background: #f1f4fa; color: var(--muted); font-size: 0.72rem; font-weight: 500; }
</style>
