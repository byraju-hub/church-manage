<script lang="ts">
	import { registry } from '#lib/registry/store.svelte.ts';

	// 디모데(옛 교적 프로그램) 행을 지금 교인과 대조 (가상 예시)
	type Row = { id: string; name: string; phone: string; birth: string; addr: string; match: string | null };
	let rows = $state<Row[]>([
		{ id: 'r1', name: '홍길동', phone: '010-0000-0001', birth: '1962-04-05', addr: '가상시 가상구 가상로 1', match: 'p1' },
		{ id: 'r2', name: '김영수', phone: '', birth: '1975-12-24', addr: '가상시 가상구 가상로 9', match: 'p13' },
		{ id: 'r3', name: '장보고', phone: '010-0000-0077', birth: '1970-01-01', addr: '가상시 가상구 가상로 7', match: null }
	]);
	let msg = $state('');
	const act = (r: Row, how: string) => {
		msg = `${r.name}: ${how} (데모)`;
		rows = rows.filter((x) => x.id !== r.id);
	};
</script>

<h1>디모데 가져오기</h1>
<p class="muted">디모데 행을 지금 교인과 대조해 연결하거나 새 교적으로 만들고, 비어 있는 칸만 채웁니다. 주소·직업·신급은 아직 비어 있는 사람이 많습니다. (가상 예시)</p>
{#if msg}<div class="ok">{msg}</div>{/if}
<div class="card" style="padding:0;overflow-x:auto">
	<table>
		<thead><tr><th>디모데 이름</th><th>전화</th><th>생년월일</th><th>주소</th><th>대조 결과</th><th></th></tr></thead>
		<tbody>
			{#each rows as r (r.id)}
				<tr>
					<td>{r.name}</td><td>{r.phone || '-'}</td><td>{r.birth}</td><td>{r.addr}</td>
					<td>{#if r.match}<a href="/{r.match}">{registry.person(r.match)?.name} (같은 사람 후보)</a>{:else}일치하는 교인 없음{/if}</td>
					<td class="row">
						{#if r.match}<button onclick={() => act(r, '기존 교적에 연결, 빈 칸만 채움')}>연결·빈 칸 채우기</button>{:else}<button onclick={() => act(r, '새 교적 만들기')}>새 교적</button>{/if}
						<button class="ghost" onclick={() => act(r, '건너뜀')}>건너뛰기</button>
					</td>
				</tr>
			{:else}
				<tr><td colspan="6" class="muted">대조할 행이 없습니다.</td></tr>
			{/each}
		</tbody>
	</table>
</div>
