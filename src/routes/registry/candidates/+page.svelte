<script lang="ts">
	import { registry } from '#lib/registry/store.svelte.ts';

	// 처음 교적을 만들 때 올리지 않은 사람, 앱 가입 때 합치지 못한 중복 (가상 예시)
	type C = { id: string; name: string; phone: string; reason: string; match?: string };
	let list = $state<C[]>([
		{ id: 'c1', name: '김영수', phone: '010-0000-0013', reason: '앱 가입 — 같은 이름·전화의 교적이 있음', match: 'p13' },
		{ id: 'c2', name: '임꺽정', phone: '010-0000-0099', reason: '앱 가입자인데 교적이 없음' },
		{ id: 'c3', name: '한나리', phone: '010-0000-0012', reason: '앱 가입 — 같은 이름·전화의 교적이 있음', match: 'p12' }
	]);
	let msg = $state('');
	const resolve = (c: C, how: string) => {
		msg = `${c.name}: ${how} (데모 — 실제로 저장되지 않습니다)`;
		list = list.filter((x) => x.id !== c.id);
	};
</script>

<h1>확인 목록</h1>
<p class="muted">처음 교적을 만들 때 올리지 않은 사람, 앱에 가입했지만 합치지 못한 중복 후보입니다. (가상 예시)</p>
{#if msg}<div class="ok">{msg}</div>{/if}
<div class="card" style="padding:0">
	<table>
		<thead><tr><th>이름</th><th>전화</th><th>사유</th><th>기존 교적</th><th></th></tr></thead>
		<tbody>
			{#each list as c (c.id)}
				<tr>
					<td>{c.name}</td><td>{c.phone}</td><td>{c.reason}</td>
					<td>{#if c.match}<a href="/registry/{c.match}">{registry.person(c.match)?.name} 교적 보기</a>{:else}-{/if}</td>
					<td class="row">
						{#if c.match}<button onclick={() => resolve(c, '기존 교적에 합침')}>합치기</button>{:else}<button onclick={() => resolve(c, '새 교적으로 올림')}>새 교적 만들기</button>{/if}
						<button class="ghost" onclick={() => resolve(c, '건너뜀')}>건너뛰기</button>
					</td>
				</tr>
			{:else}
				<tr><td colspan="5" class="muted">확인할 사람이 없습니다.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
