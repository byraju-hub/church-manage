<script lang="ts">
	import { store } from '#lib/store.svelte.ts';
	import { STATUS_LABEL, BAPTISM_LABEL, POSITIONS, type Member } from '#lib/types.ts';

	let { initial, onsave }: { initial: Member; onsave: (m: Member) => void } = $props();
	// svelte-ignore state_referenced_locally
	let f = $state<Member>({ ...initial });

	const nul = (v: string | null) => (v === '' ? null : v);
	function submit(e: SubmitEvent) {
		e.preventDefault();
		onsave({
			...f,
			gender: nul(f.gender) as Member['gender'],
			birth_date: nul(f.birth_date), phone: nul(f.phone), email: nul(f.email), address: nul(f.address),
			family_id: nul(f.family_id), family_relation: nul(f.family_relation), group_id: nul(f.group_id),
			position: nul(f.position), registered_at: nul(f.registered_at), baptism_date: nul(f.baptism_date),
			previous_church: nul(f.previous_church), memo: nul(f.memo)
		});
	}
</script>

<form class="form card" onsubmit={submit}>
	<label>이름 *<input required bind:value={f.name} /></label>
	<label>성별
		<select bind:value={f.gender}><option value={null}>-</option><option value="M">남</option><option value="F">여</option></select>
	</label>
	<label>생년월일<input type="date" bind:value={f.birth_date} /></label>
	<label>전화번호<input bind:value={f.phone} placeholder="010-0000-0000" /></label>
	<label>이메일<input type="email" bind:value={f.email} /></label>
	<label class="wide">주소<input bind:value={f.address} /></label>

	<label>상태
		<select bind:value={f.status}>{#each Object.entries(STATUS_LABEL) as [k, v]}<option value={k}>{v}</option>{/each}</select>
	</label>
	<label>직분
		<select bind:value={f.position}><option value={null}>-</option>{#each POSITIONS as p}<option>{p}</option>{/each}</select>
	</label>
	<label>구역
		<select bind:value={f.group_id}><option value={null}>-</option>{#each store.groups as g}<option value={g.id}>{g.name}</option>{/each}</select>
	</label>
	<label>가정
		<select bind:value={f.family_id}><option value={null}>-</option>{#each store.families as fa}<option value={fa.id}>{fa.name}</option>{/each}</select>
	</label>
	<label>가정 내 관계<input bind:value={f.family_relation} placeholder="세대주, 배우자, 자녀…" /></label>
	<label>등록일<input type="date" bind:value={f.registered_at} /></label>
	<label>세례 구분
		<select bind:value={f.baptism_type}>{#each Object.entries(BAPTISM_LABEL) as [k, v]}<option value={k}>{v}</option>{/each}</select>
	</label>
	<label>세례일<input type="date" bind:value={f.baptism_date} /></label>
	<label>이전 출석교회<input bind:value={f.previous_church} /></label>
	<label class="wide">메모<textarea rows="3" bind:value={f.memo}></textarea></label>

	<div class="wide row"><button type="submit">저장</button><a class="btn ghost" href="/members">취소</a></div>
</form>
