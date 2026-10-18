<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { store } from '#lib/store.svelte.ts';
	import { STATUS_LABEL, BAPTISM_LABEL } from '#lib/types.ts';

	const m = $derived(store.member(page.params.id!));
	const relatives = $derived(m ? store.familyMembers(m.family_id).filter((x) => x.id !== m.id) : []);
	const visits = $derived(m ? store.visitsOf(m.id) : []);

	let vDate = $state(new Date().toISOString().slice(0, 10));
	let vType = $state('정기심방');
	let vBy = $state('');
	let vContent = $state('');

	function addVisit(e: SubmitEvent) {
		e.preventDefault();
		store.addVisit({ member_id: m!.id, visit_date: vDate, visit_type: vType, visited_by: vBy || null, content: vContent || null });
		vContent = '';
	}
	function remove() {
		if (confirm(`${m!.name} 님을 삭제할까요?`)) {
			store.deleteMember(m!.id);
			goto('/members');
		}
	}
	const v = (x: string | null) => x ?? '-';
</script>

{#if m}
	<div class="row" style="justify-content:space-between">
		<h1>{m.name} <span class="badge {m.status}">{STATUS_LABEL[m.status]}</span></h1>
		<div class="row">
			<a class="btn ghost" href="/members/{m.id}/edit">수정</a>
			<button class="danger" onclick={remove}>삭제</button>
		</div>
	</div>

	<div class="card">
		<dl>
			<dt>직분</dt><dd>{v(m.position)}</dd>
			<dt>성별</dt><dd>{m.gender === 'M' ? '남' : m.gender === 'F' ? '여' : '-'}</dd>
			<dt>생년월일</dt><dd>{v(m.birth_date)}</dd>
			<dt>전화번호</dt><dd>{v(m.phone)}</dd>
			<dt>이메일</dt><dd>{v(m.email)}</dd>
			<dt>주소</dt><dd>{v(m.address)}</dd>
			<dt>구역</dt><dd>{store.group(m.group_id)?.name ?? '-'}</dd>
			<dt>등록일</dt><dd>{v(m.registered_at)}</dd>
			<dt>세례</dt><dd>{m.baptism_type ? BAPTISM_LABEL[m.baptism_type] : '-'}{m.baptism_date ? ` (${m.baptism_date})` : ''}</dd>
			<dt>이전 교회</dt><dd>{v(m.previous_church)}</dd>
			<dt>메모</dt><dd>{v(m.memo)}</dd>
		</dl>
	</div>

	<div class="card">
		<h2>가정: {store.family(m.family_id)?.name ?? '미지정'}</h2>
		{#each relatives as r}
			<div><a href="/members/{r.id}">{r.name}</a> <span class="muted">· {v(r.family_relation)}</span></div>
		{:else}
			<span class="muted">같은 가정의 다른 교인이 없습니다.</span>
		{/each}
	</div>

	<div class="card">
		<h2>심방 기록</h2>
		{#each visits as x (x.id)}
			<div style="margin-bottom:.6rem"><b>{x.visit_date}</b> · {v(x.visit_type)} · {v(x.visited_by)}<br /><span class="muted">{v(x.content)}</span></div>
		{:else}
			<p class="muted">기록이 없습니다.</p>
		{/each}
		<form class="form" onsubmit={addVisit} style="margin-top:.8rem">
			<label>날짜<input type="date" bind:value={vDate} required /></label>
			<label>구분<input bind:value={vType} /></label>
			<label>심방자<input bind:value={vBy} /></label>
			<label class="wide">내용<textarea rows="2" bind:value={vContent}></textarea></label>
			<div class="wide"><button type="submit">심방 기록 추가</button></div>
		</form>
	</div>
{:else}
	<p>교인을 찾을 수 없습니다. <a href="/members">목록으로</a></p>
{/if}
