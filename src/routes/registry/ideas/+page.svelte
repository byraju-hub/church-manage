<script lang="ts">
	// 안내서 '기능 아이디어' 표 + 프로토타입에서 시험해 볼 수 있는 위치
	const rows: { f: string; data: string; st: '바로 가능' | '일부 가능' | '새 자료 필요'; more: string; href?: string }[] = [
		{ f: '생일·결혼기념일 명단(주간·월간)', data: '생년월일, 음력 여부, 결혼기념일', st: '바로 가능', more: '음력 생일은 그해 양력으로 바꿔 보여야 함', href: '/registry/reports' },
		{ f: '공동체·소그룹별 교적 명단', data: '소그룹 소속, 상태, 신급, 직분', st: '바로 가능', more: '', href: '/registry/reports' },
		{ f: '직분자 명단(시무·은퇴·명예 등)', data: '직분 이력', st: '바로 가능', more: '임직일이 비어 있는 사람이 많을 수 있음', href: '/registry/reports' },
		{ f: '학습·세례 대상자 찾기', data: '신급, 나이, 등록일', st: '바로 가능', more: "신급 '미확인'을 먼저 확인해야 정확함", href: '/registry/reports' },
		{ f: '전입·전출·별세 처리와 현황', data: '재적 이력(날짜·사유·교회)', st: '바로 가능', more: '', href: '/registry' },
		{ f: '새가족 현황·정착 관리', data: '등록 기록, 등록일, 인도자, 소그룹', st: '일부 가능', more: '새가족 교육 과정·수료·정착 판정 칸', href: '/registry/new' },
		{ f: '교세 통계(노회 보고)', data: '상태·신급·직분·성별·나이 집계', st: '일부 가능', more: '합동 노회 보고 서식', href: '/registry/reports' },
		{ f: '가족 보기', data: '세대·세대원·관계', st: '일부 가능', more: '세대 입력이 아직 덜 됨', href: '/registry/households' },
		{ f: '장기 결석자 찾기', data: '출석부 출석 기록 + 교적 상태', st: '일부 가능', more: '출석부 기록과 이어 붙이는 작업' },
		{ f: '교적부·교인증명서·세례증명서·이명증서 출력', data: '교적 카드, 신급·재적 이력', st: '일부 가능', more: '실물 양식, 발급 대장' },
		{ f: '심방 기록·심방 계획', data: '없음(지금은 담당자 메모)', st: '새 자료 필요', more: '날짜, 심방자, 내용, 후속 조치, 누가 볼지', href: '/registry/p10' },
		{ f: '선교회·부서·찬양대·봉사 소속', data: '없음', st: '새 자료 필요', more: '조직과 소속 기간 칸', href: '/registry/p2' },
		{ f: '소그룹 이동 이력·연도별 편성', data: '없음(현재 소속만)', st: '새 자료 필요', more: '소속 시작일·종료일', href: '/registry/p6' }
	];
	const cls = (s: string) => (s === '바로 가능' ? 'now' : s === '일부 가능' ? 'part' : 'new');
</script>

<h1>기능 아이디어</h1>
<p class="muted">안내서의 기능 표입니다. '새 자료 필요'는 칸을 새로 만들어야 해서 시간이 더 걸린다는 뜻이지 안 된다는 뜻이 아닙니다. 오른쪽 링크로 프로토타입에서 시험해 볼 수 있습니다. (소그룹 리더 심방·부서 소속은 교적 카드의 '심방'·'소속' 탭)</p>
<div class="card" style="padding:0;overflow-x:auto">
	<table class="sm">
		<thead><tr><th>기능</th><th>쓰는 자료</th><th>지금 자료로</th><th>더 필요한 것</th><th>시험해 보기</th></tr></thead>
		<tbody>
			{#each rows as r}
				<tr><td>{r.f}</td><td>{r.data}</td><td><span class="tag {cls(r.st)}">{r.st}</span></td><td>{r.more || '-'}</td><td>{#if r.href}<a href={r.href}>열기</a>{:else}<span class="muted">-</span>{/if}</td></tr>
			{/each}
		</tbody>
	</table>
</div>
