<script lang="ts">
	import { registry } from '#lib/registry/store.svelte.ts';

	let msg = $state('');
	const staff = [
		{ name: '교적 담당 간사', perms: '열람 · 수정' },
		{ name: '담임목사', perms: '열람 · 심방' },
		{ name: '교역자 A', perms: '열람 · 심방' },
		{ name: '소그룹 리더 (예: 홍도령)', perms: '교적 권한 없음' }
	];
</script>

<h1>권한·기록 <span class="tag">사이트 관리자</span></h1>
{#if !registry.perms.admin}
	<div class="warn">사이트 관리자 권한이 필요합니다. (위 '내 교적 권한'에서 '사이트 관리자'를 켜 보세요)</div>
{:else}
	{#if msg}<div class="ok">{msg}</div>{/if}
	<div class="card">
		<h2>교적 권한</h2>
		<p class="muted">정한 방침: 교적 담당 간사는 수정까지, 교역자는 열람과 심방. 디모데 자료를 정리하는 동안에는 교역자도 수정 권한. 소그룹 리더와 일반 교인은 교적 권한이 없습니다. (가상 예시)</p>
		<table class="sm"><thead><tr><th>사람</th><th>권한</th><th></th></tr></thead><tbody>
			{#each staff as s}<tr><td>{s.name}</td><td>{s.perms}</td>
				<td class="row"><button class="ghost" onclick={() => (msg = `${s.name}: 권한 변경 (데모)`)}>권한 주기/빼기</button><button class="ghost" onclick={() => (msg = `${s.name}: 교적 비밀번호 초기화 (데모)`)}>비밀번호 초기화</button></td></tr>{/each}
		</tbody></table>
		<p class="muted">공동체별로 나눠 맡기는 칸은 준비돼 있지만 쓰지 않습니다 (지금은 전체 교인을 보는 권한만).</p>
	</div>
	<div class="card">
		<h2>접속기록 <span class="muted" style="font-weight:400">— 검색·열람·수정·내려받기·출력 (3년 보관)</span></h2>
		<table class="sm"><thead><tr><th>시각</th><th>누가</th><th>무엇을</th><th>대상</th></tr></thead><tbody>
			{#each registry.d.accessLog.slice(0, 50) as l (l.id)}<tr><td>{l.at}</td><td>{l.who}</td><td>{l.action}</td><td>{l.target}</td></tr>
			{:else}<tr><td colspan="4" class="muted">아직 기록이 없습니다. 교적 카드를 열거나 수정해 보세요.</td></tr>{/each}
		</tbody></table>
	</div>
{/if}
