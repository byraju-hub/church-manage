<script lang="ts">
	// 안내서 '기능 아이디어' 표 + 프로토타입에서 시험해 볼 수 있는 위치
	const rows: { f: string; data: string; st: '프로토타입에 있음' | '일부 가능' | '새 자료 필요'; more: string; href?: string }[] = [
		{ f: '통합 검색창(무엇이든 검색)', data: '교인·소그룹·세대·심방·메모·조직', st: '프로토타입에 있음', more: '실제는 DB 전체 텍스트 검색 필요', href: '/' },
		{ f: '캘린더(생일·기념일·절기·사역·성례·심방 계획)', data: '생년월일, 결혼기념일, 일정, 심방 계획', st: '프로토타입에 있음', more: '음력 생일은 해당 연도 양력으로 바꿔야 함(지금은 같은 월·일로 표시)', href: '/' },
		{ f: '교인 검색: 기본·복수·항목별', data: '교적 카드 전체', st: '프로토타입에 있음', more: '', href: '/members' },
		{ f: '공동체 편성표(인도자·장소)', data: '출석부 편성 자료', st: '프로토타입에 있음', more: '출석부와 연동 방식 확정 필요', href: '/communities' },
		{ f: '주일 출석 등록(소그룹별·미지정자·사유)', data: '출석부', st: '일부 가능', more: '기존 출석부와 이중 입력 되지 않게 연동', href: '/attendance' },
		{ f: '심방 등록·목록 검색·달력 검색', data: '심방 기록(구분·말씀·찬송·후속조치)', st: '프로토타입에 있음', more: '스데반정보 덤프의 심방 코드표 확인', href: '/visits' },
		{ f: '조직(당회·집사회·권사회·전도회·조직표)', data: '직분 이력, 전도회, 소속', st: '프로토타입에 있음', more: '', href: '/orgs' },
		{ f: '통계(출석·소그룹·임직·세례)', data: '출석부, 직분·신급 이력', st: '일부 가능', more: '교육부서 보고서 연동', href: '/stats' },
		{ f: '새가족 교육 수료 관리', data: '교육 과정·수료일', st: '프로토타입에 있음', more: '수료 시 교인구분 자동 변경 여부 결정 필요', href: '/p9' },
		{ f: '교인구분 3단계·조직표 설정', data: '카테고리, 조직 단위', st: '프로토타입에 있음', more: '', href: '/settings' },
		{ f: '교적부·교인증명서·세례증명서·이명증서 출력', data: '교적 카드, 신급·재적 이력', st: '일부 가능', more: '실물 양식, 발급 대장' },
		{ f: '교세 통계(노회 보고)', data: '상태·신급·직분·성별·나이 집계', st: '일부 가능', more: '합동 노회 보고 서식', href: '/reports' },
		{ f: '심방 계획 자동 배정(공동체별)', data: '심방 계획', st: '새 자료 필요', more: '배정 규칙(교역자·공동체) 정해야 함' }
	];
	const cls = (s: string) => (s === '프로토타입에 있음' ? 'now' : s === '일부 가능' ? 'part' : 'new');
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
