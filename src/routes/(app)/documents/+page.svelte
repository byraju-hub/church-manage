<script lang="ts">
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';
	import PersonPicker from '#lib/components/PersonPicker.svelte';
	import ExportButtons from '#lib/components/ExportButtons.svelte';
	import { ageOf, fullAddress, officeTitle } from '#lib/registry/derive.ts';
	import { COMMUNITY_DEFS } from '#lib/registry/config.ts';

	// 문서 출력: 화면에서 미리 보고 → 인쇄 또는 PDF 내려받기. 출력할 때마다 접속기록(출력)과 발급번호를 남김
	// [실제 시스템] 증명서 발급 대장을 따로 두고(발급번호·용도·발급자), 교회 직인 이미지를 넣습니다.
	//              PDF는 지금처럼 브라우저에서 만들어도 되고, 서버에서 만들면 글꼴·서식이 더 일정합니다.
	const DOCS = ['교적부', '교인증명서', '세례증명서', '교인 요람', '생일 명단', '직분자 명단', '교회 조직표'] as const;
	type Doc = (typeof DOCS)[number];
	let doc = $state<Doc>((page.url.searchParams.get('doc') as Doc) ?? '교적부');
	let personId = $state(page.url.searchParams.get('person') ?? '');
	let purpose = $state('제출용');
	let month = $state(new Date().getMonth() + 1);
	let comm = $state('전체');
	let consentOnly = $state(true);
	let busy = $state(false);
	let sheet = $state<HTMLElement | null>(null);

	const CHURCH = '부평동부교회';
	const now = new Date();
	const todayKo = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일`;
	const pastor = $derived(registry.d.people.find((p) => p.clergy_title === '담임목사')?.name ?? '');
	const p = $derived(personId ? registry.person(personId) : undefined);
	const s = $derived(p ? registry.summary(p) : null);
	const needsPerson = $derived(doc === '교적부' || doc === '교인증명서' || doc === '세례증명서');
	const issued = $derived(registry.d.accessLog.filter((l) => l.action === '출력' && l.at.startsWith(String(now.getFullYear()))).length);
	const docNo = $derived(`제 ${now.getFullYear()}-${String(issued + 1).padStart(3, '0')} 호`);
	const v = (x: unknown) => (x === null || x === undefined || x === '' ? '' : String(x));
	const md = (iso: string | null) => (iso ? `${+iso.slice(5, 7)}월 ${+iso.slice(8, 10)}일` : '');
	const ymd = (iso: string | null) => (iso ? `${iso.slice(0, 4)}. ${+iso.slice(5, 7)}. ${+iso.slice(8, 10)}.` : '');

	// ---- 교적부 ----
	const hh = $derived(p ? registry.householdOf(p.id) : undefined);
	const family = $derived(hh ? registry.membersOfHousehold(hh.id) : []);
	const sortD = <T extends { event_date?: string | null; start_date?: string | null }>(xs: T[]) => [...xs].sort((a, b) => (a.event_date ?? a.start_date ?? '').localeCompare(b.event_date ?? b.start_date ?? ''));
	const baptism = $derived(p ? sortD(registry.faithOf(p.id)).filter((f) => f.kind === '세례' || f.kind === '유아세례' || f.kind === '입교').at(-1) : undefined);

	// ---- 목록 문서 ----
	const members = $derived(registry.d.people.map((x) => ({ p: x, s: registry.summary(x) })).filter((x) => x.s.memberCert));
	const consented = (id: string) => registry.d.consents.some((c) => c.person_id === id && c.kind === '요람 공개' && !c.revoked_on);
	const directory = $derived(
		members.filter((x) => (comm === '전체' || x.s.community === comm) && (!consentOnly || consented(x.p.id)))
			.sort((a, b) => (a.s.community + a.s.smallGroup).localeCompare(b.s.community + b.s.smallGroup, 'ko') || a.p.name.localeCompare(b.p.name, 'ko'))
	);
	const birthdays = $derived(
		members.filter((x) => x.p.birth_date && +x.p.birth_date.slice(5, 7) === month).sort((a, b) => a.p.birth_date!.slice(8).localeCompare(b.p.birth_date!.slice(8)))
	);
	const officers = $derived(
		registry.d.officeTerms.filter((t) => !t.end_date && t.rank_status !== '사임' && registry.person(t.person_id) && registry.summary(registry.person(t.person_id)!).memberCert)
			.map((t) => ({ t, p: registry.person(t.person_id)! }))
			.sort((a, b) => ['목사', '전도사', '사모', '장로', '시무집사', '권사', '서리집사'].indexOf(a.t.office) - ['목사', '전도사', '사모', '장로', '시무집사', '권사', '서리집사'].indexOf(b.t.office) || a.p.name.localeCompare(b.p.name, 'ko'))
	);
	const committees = $derived(registry.d.orgUnits.filter((o) => !o.parent_id).sort((a, b) => a.sort_order - b.sort_order));
	const deptsOf = (id: string) => registry.d.orgUnits.filter((o) => o.parent_id === id).sort((a, b) => a.sort_order - b.sort_order);
	const pname = (id: string | null) => (id ? registry.person(id)?.name ?? '' : '');
	const ready = $derived(!needsPerson || (!!p && (doc !== '세례증명서' || !!baptism)));
	const fileName = $derived(`${doc}${p && needsPerson ? `-${p.name}` : doc === '생일 명단' ? `-${month}월` : ''}-${now.toISOString().slice(0, 10)}.pdf`);

	function record() {
		registry.log('출력', `${doc}${p && needsPerson ? ` · ${p.name}` : ''}${needsPerson && doc !== '교적부' ? ` · ${docNo} · ${purpose}` : ''}`);
	}
	function print() {
		record();
		window.print();
	}
	async function pdf() {
		if (!sheet) return;
		busy = true;
		try {
			const html2pdf = (await import('html2pdf.js')).default;
			// pagebreak: 표의 줄이 페이지 사이에서 잘리지 않게 함 (타입 정의에는 없지만 html2pdf 가 지원하는 설정)
			const opts = { margin: [10, 10, 12, 10], filename: fileName, image: { type: 'jpeg', quality: 0.96 }, html2canvas: { scale: 2, useCORS: true }, jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }, pagebreak: { mode: ['css', 'legacy'], avoid: ['tr', '.keep'] } };
			await html2pdf()
				.set(opts as unknown as Record<string, never>)
				.from(sheet)
				.save();
			record();
		} finally {
			busy = false;
		}
	}
</script>

<div class="no-print">
	<h1>문서 출력</h1>
	{#if !registry.perms.export}
		<div class="warn">문서 출력은 최고관리자에게 내려받기·출력 권한을 받은 사용자만 할 수 있습니다.</div>
	{/if}
	<div class="card">
		<div class="tabs" style="margin-bottom:.8rem">{#each DOCS as d}<button class:on={doc === d} onclick={() => (doc = d)}>{d}</button>{/each}</div>
		<div class="toolbar">
			{#if needsPerson}
				<div style="flex:1 1 320px;max-width:420px"><PersonPicker bind:value={personId} placeholder="교인 이름 검색" /></div>
				{#if doc !== '교적부'}<label class="row" style="gap:.4rem"><span class="muted">용도</span><select bind:value={purpose} style="width:auto">{#each ['제출용', '이명용', '학교 제출용', '직장 제출용', '기타'] as x}<option>{x}</option>{/each}</select></label>{/if}
			{:else if doc === '생일 명단'}
				<label class="row" style="gap:.4rem"><span class="muted">월</span><select bind:value={month} style="width:auto">{#each Array.from({ length: 12 }, (_, i) => i + 1) as m}<option value={m}>{m}월</option>{/each}</select></label>
			{:else if doc === '교인 요람'}
				<select bind:value={comm} style="width:auto"><option>전체</option>{#each COMMUNITY_DEFS as c}<option>{c.name}</option>{/each}</select>
				<label class="row" style="gap:.3rem"><input type="checkbox" bind:checked={consentOnly} />요람 공개에 동의한 사람만</label>
			{/if}
			<span style="flex:1"></span>
			<ExportButtons onprint={print} onpdf={pdf} disabled={!ready || !registry.perms.export} {busy} />
		</div>
		{#if doc === '교인 요람' && consentOnly}<p class="muted" style="margin:0;font-size:.82rem">요람에는 '요람 공개'에 동의한 사람만 나옵니다. (일괄 동의를 받기 전이라 지금은 몇 명만 있습니다. 시험할 때는 체크를 풀어 보세요)</p>{/if}
		{#if doc === '세례증명서' && p && !baptism}<p class="warn" style="margin:.4rem 0 0">이 교인은 세례(유아세례·입교) 기록이 없어 세례증명서를 만들 수 없습니다.</p>{/if}
	</div>
</div>

{#if ready}
	<div class="sheet-wrap">
		<div class="sheet" bind:this={sheet}>
			{#if doc === '교적부' && p && s}
				<div class="doc-head"><span>{CHURCH}</span><h2>교 적 부</h2><span>출력일 {ymd(now.toISOString().slice(0, 10))}</span></div>
				<table class="dt">
					<tbody>
						<tr>
							<td rowspan="5" class="photo-cell">{#if p.photo}<img src={p.photo} alt="" />{:else}<span>사진</span>{/if}</td>
							<th>이름</th><td>{p.name}{p.name_note ? ` (${p.name_note})` : ''}</td><th>교번</th><td>{v(p.reg_no)}</td>
						</tr>
						<tr><th>생년월일</th><td>{ymd(p.birth_date)} ({p.birth_lunar ? '음력' : '양력'}) · 만 {ageOf(p.birth_date) ?? ''}세</td><th>성별</th><td>{p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : ''}</td></tr>
						<tr><th>휴대폰</th><td>{v(p.phone)}</td><th>집전화</th><td>{v(hh?.home_phone)}</td></tr>
						<tr><th>주소</th><td colspan="3">{fullAddress(p, hh)}</td></tr>
						<tr><th>직업 / 직장</th><td>{[p.occupation, p.workplace].filter(Boolean).join(' / ')}</td><th>결혼</th><td>{v(p.marital_status)}{p.wedding_date ? ` · ${ymd(p.wedding_date)}` : ''}</td></tr>
						<tr><th colspan="2">교인구분</th><td>{s.category}</td><th>직분</th><td>{s.title || '성도'}</td></tr>
						<tr><th colspan="2">등록일</th><td>{ymd(s.registered)}</td><th>신급</th><td>{s.faith}</td></tr>
						<tr><th colspan="2">공동체 · 소그룹</th><td>{s.community ? `${s.community} · ${s.smallGroup}` : ''}</td><th>전도회</th><td>{v(p.mission_society)}</td></tr>
						<tr><th colspan="2">이전 교회</th><td>{v(p.previous_church)}</td><th>인도자</th><td>{p.guide_person_id ? registry.person(p.guide_person_id)?.name : v(p.guide_name)}</td></tr>
					</tbody>
				</table>

				<h4>가족 (세대 {hh?.no ?? ''})</h4>
				<table class="dt list"><thead><tr><th>관계</th><th>이름</th><th>생년</th><th>직분</th><th>신급</th><th>비고</th></tr></thead><tbody>
					{#each family as m}
						{@const fp = m.person_id ? registry.person(m.person_id) : undefined}
						<tr><td>{m.relation}</td><td>{fp?.name ?? m.name}</td><td>{fp?.birth_date?.slice(0, 4) ?? v(m.birth_year)}</td><td>{fp ? registry.summary(fp).title : ''}</td><td>{fp ? registry.summary(fp).faith : ''}</td><td>{fp ? '' : '교인 아님'}</td></tr>
					{:else}<tr><td colspan="6" class="c">세대 정보 없음</td></tr>{/each}
				</tbody></table>

				<div class="two">
					<div>
						<h4>신급 이력</h4>
						<table class="dt list"><thead><tr><th>구분</th><th>날짜</th><th>교회</th><th>집례</th></tr></thead><tbody>
							{#each sortD(registry.faithOf(p.id)) as e}<tr><td>{e.kind}</td><td>{ymd(e.event_date)}</td><td>{e.church ?? '본 교회'}</td><td>{v(e.officiant)}</td></tr>
							{:else}<tr><td colspan="4" class="c">기록 없음</td></tr>{/each}
						</tbody></table>
					</div>
					<div>
						<h4>직분 이력</h4>
						<table class="dt list"><thead><tr><th>직분</th><th>구분</th><th>임직(시작)</th><th>끝</th></tr></thead><tbody>
							{#each sortD(registry.officesOf(p.id)) as t}<tr><td>{t.office}</td><td>{t.rank_status}</td><td>{ymd(t.start_date)}</td><td>{ymd(t.end_date)}</td></tr>
							{:else}<tr><td colspan="4" class="c">성도</td></tr>{/each}
						</tbody></table>
					</div>
				</div>
				<h4>재적 이력</h4>
				<table class="dt list"><thead><tr><th>기록</th><th>날짜</th><th>사유</th><th>교회</th></tr></thead><tbody>
					{#each sortD(registry.statusOf(p.id)) as e}<tr><td>{e.kind}</td><td>{ymd(e.event_date)}</td><td>{v(e.reason)}</td><td>{v(e.church)}</td></tr>
					{:else}<tr><td colspan="4" class="c">기록 없음</td></tr>{/each}
				</tbody></table>
				<h4>교회봉사</h4>
				<table class="dt list"><thead><tr><th>부서</th><th>역할</th><th>시작</th><th>끝</th></tr></thead><tbody>
					{#each registry.d.affiliations.filter((a) => a.person_id === p.id) as a}<tr><td>{a.org}</td><td>{v(a.role)}</td><td>{ymd(a.start_date)}</td><td>{ymd(a.end_date)}</td></tr>
					{:else}<tr><td colspan="4" class="c">없음</td></tr>{/each}
				</tbody></table>
				<p class="foot-note">이 문서는 개인정보를 담고 있습니다. 용도가 끝나면 파기해 주세요.</p>

			{:else if (doc === '교인증명서' || doc === '세례증명서') && p && s}
				<div class="cert">
					<p class="cert-no">{docNo}</p>
					<h2 class="cert-title">{doc === '교인증명서' ? '교 인 증 명 서' : '세 례 증 명 서'}</h2>
					<table class="dt cert-table"><tbody>
						<tr><th>성 명</th><td>{p.name}</td><th>생년월일</th><td>{ymd(p.birth_date)}</td></tr>
						<tr><th>주 소</th><td colspan="3">{fullAddress(p, hh)}</td></tr>
						{#if doc === '교인증명서'}
							<tr><th>등 록 일</th><td>{ymd(s.registered)}</td><th>직 분</th><td>{s.title || '성도'}</td></tr>
							<tr><th>신 급</th><td>{s.faith}</td><th>용 도</th><td>{purpose}</td></tr>
						{:else if baptism}
							<tr><th>구 분</th><td>{baptism.kind}</td><th>세 례 일</th><td>{ymd(baptism.event_date)}</td></tr>
							<tr><th>세례 교회</th><td>{baptism.church ?? CHURCH}</td><th>집 례 자</th><td>{v(baptism.officiant)}</td></tr>
							<tr><th>용 도</th><td colspan="3">{purpose}</td></tr>
						{/if}
					</tbody></table>
					<p class="cert-body">{doc === '교인증명서' ? '위 사람은 본 교회에 등록된 교인임을 증명합니다.' : `위 사람은 위와 같이 ${baptism?.kind ?? '세례'}를 받았음을 증명합니다.`}</p>
					<p class="cert-date">{todayKo}</p>
					<!-- 교회 이름 자리에 교회 로고(대한예수교장로회 부평동부교회) -->
					<p class="cert-sign"><img class="cert-logo" src="/church-logo.png" alt="대한예수교장로회 {CHURCH}" width="360" height="67" style="width:95mm;height:auto" /><br />담임목사 <b>{pastor}</b> <span class="seal">(인)</span></p>
				</div>

			{:else if doc === '교인 요람'}
				<div class="doc-head"><span>{CHURCH}</span><h2>교인 요람</h2><span>{comm === '전체' ? '전체 공동체' : comm} · {directory.length}명</span></div>
				<table class="dt list zebra"><thead><tr><th>공동체</th><th>소그룹</th><th>이름</th><th>직분</th><th>휴대폰</th><th>주소</th></tr></thead><tbody>
					{#each directory as { p: x, s: xs } (x.id)}<tr><td>{xs.community.replace(' 공동체', '')}</td><td>{xs.smallGroup}</td><td><b>{x.name}</b></td><td>{xs.title}</td><td>{v(x.phone)}</td><td>{fullAddress(x, registry.householdOf(x.id))}</td></tr>
					{:else}<tr><td colspan="6" class="c">요람에 실을 사람이 없습니다.</td></tr>{/each}
				</tbody></table>
				<p class="foot-note">요람 공개에 동의한 교인만 실었습니다. 교회 밖으로 내보내지 마세요.</p>

			{:else if doc === '생일 명단'}
				<div class="doc-head"><span>{CHURCH}</span><h2>{month}월 생일 명단</h2><span>{birthdays.length}명</span></div>
				<table class="dt list zebra"><thead><tr><th>날짜</th><th>이름</th><th>직분</th><th>양/음</th><th>나이</th><th>공동체 · 소그룹</th><th>휴대폰</th></tr></thead><tbody>
					{#each birthdays as { p: x, s: xs } (x.id)}<tr><td class="c">{md(x.birth_date)}</td><td><b>{x.name}</b></td><td>{xs.title}</td><td class="c">{x.birth_lunar ? '음력' : '양력'}</td><td class="c">{(ageOf(x.birth_date) ?? 0) + (+x.birth_date!.slice(5, 7) > now.getMonth() + 1 ? 1 : 0)}</td><td>{xs.smallGroup ? `${xs.community.replace(' 공동체', '')} · ${xs.smallGroup}` : ''}</td><td>{v(x.phone)}</td></tr>
					{:else}<tr><td colspan="7" class="c">이 달 생일자가 없습니다.</td></tr>{/each}
				</tbody></table>
				<p class="foot-note">음력 생일은 해당 연도의 양력 날짜로 바꿔야 정확합니다. (실제 시스템에서 변환)</p>

			{:else if doc === '교회 조직표'}
				<div class="doc-head"><span>{CHURCH}</span><h2>{now.getFullYear()}년도 교회 조직표</h2><span>{todayKo}</span></div>
				<table class="dt list meet-t"><thead><tr><th>회의</th><th>의장</th><th>서기</th></tr></thead><tbody>
					{#each registry.d.meetings as m (m.meeting)}<tr><td class="c"><b>{m.meeting}</b></td><td class="c">{m.chair}</td><td class="c">{m.secretary}</td></tr>{/each}
				</tbody></table>
				<div class="org-cols">
					{#each committees as c, ci (c.id)}
						<table class="dt list keep">
							<thead><tr><th colspan="3" class="cm-th">{ci + 1}. {c.name} <span>위원장 {c.leader_id ? `${pname(c.leader_id)} 장로` : ''}</span></th></tr>
								<tr><th>부서</th><th>부서장</th><th>담당자</th></tr></thead>
							<tbody>{#each deptsOf(c.id) as d}<tr><td>{d.name}</td><td class="c">{pname(d.leader_id)}</td><td class="c">{d.staff_ids.map(pname).join(', ')}</td></tr>{/each}</tbody>
						</table>
					{/each}
				</div>

			{:else if doc === '직분자 명단'}
				<div class="doc-head"><span>{CHURCH}</span><h2>직분자 명단</h2><span>{officers.length}명</span></div>
				<table class="dt list zebra"><thead><tr><th>직분</th><th>구분</th><th>이름</th><th>표시</th><th>임직일</th><th>임직교회</th><th>소그룹</th></tr></thead><tbody>
					{#each officers as { t, p: x } (t.id)}<tr><td>{t.office}</td><td class="c">{t.rank_status}</td><td><b>{x.name}</b></td><td>{officeTitle(t)}</td><td class="c">{ymd(t.start_date)}</td><td>{t.church ?? '본 교회'}</td><td>{registry.summary(x).smallGroup}</td></tr>{/each}
				</tbody></table>
			{/if}
		</div>
	</div>
{:else if needsPerson && !p}
	<p class="empty">교인을 고르면 미리보기가 나옵니다.</p>
{/if}

<style>
	.sheet-wrap { overflow-x: auto; padding: 0.5rem 0 2rem; }
	.sheet { width: 190mm; min-height: 270mm; margin: 0 auto; background: #fff; color: #111; padding: 12mm 12mm 14mm; box-shadow: 0 6px 28px rgba(27, 36, 51, 0.14); border: 1px solid #dfe3ec; font-size: 10.5pt; line-height: 1.5; }
	.doc-head { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2.5px solid #111; padding-bottom: 6px; margin-bottom: 10px; font-size: 9pt; color: #444; }
	.doc-head h2 { margin: 0; font-size: 18pt; letter-spacing: 0.3em; color: #111; }
	h4 { margin: 14px 0 5px; font-size: 10.5pt; padding-left: 7px; border-left: 4px solid #2a50c8; }
	.dt { width: 100%; border-collapse: collapse; border: 1.5px solid #222; }
	.dt th, .dt td { border: 1px solid #8a8f9c; padding: 5px 7px; font-size: 9.5pt; text-align: left; vertical-align: middle; background: #fff; color: #111; }
	.dt th { background: #eef1f7; font-weight: 700; white-space: nowrap; width: 1%; }
	.dt.list th { width: auto; text-align: center; background: #e4e9f4; }
	.dt.zebra tbody tr:nth-child(even) td { background: #f6f8fc; }
	.dt tbody tr:hover { background: none; }
	.dt .c { text-align: center; color: #555; }
	/* 교인 요람 · 생일 명단 · 직분자 명단(zebra), 교회 조직표(meet-t · keep): 표 내용 가운데 정렬 */
	.dt.zebra td, .dt.meet-t td, .dt.keep td { text-align: center; }
	.photo-cell { width: 28mm; text-align: center; }
	.photo-cell img { width: 26mm; height: 34mm; object-fit: cover; display: block; margin: 0 auto; }
	.photo-cell span { display: grid; place-items: center; width: 26mm; height: 34mm; margin: 0 auto; border: 1px dashed #aaa; color: #999; font-size: 9pt; }
	.two { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
	.meet-t { margin-bottom: 12px; }
	.org-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; align-items: start; }
	.cm-th { background: #2a50c8 !important; color: #fff !important; text-align: left !important; font-size: 10pt !important; }
	.cm-th span { float: right; font-weight: 500; font-size: 9pt; }
	.foot-note { margin-top: 14px; font-size: 8.5pt; color: #666; border-top: 1px solid #ccc; padding-top: 6px; }
	.cert { padding: 6mm 4mm; }
	.cert-no { font-size: 10pt; color: #333; margin: 0 0 18mm; }
	.cert-title { text-align: center; font-size: 24pt; letter-spacing: 0.25em; margin: 0 0 14mm; padding-bottom: 4mm; border-bottom: 3px double #111; }
	.cert-table th { width: 22mm; text-align: center; }
	.cert-table td { padding: 9px 10px; font-size: 11pt; }
	.cert-body { text-align: center; font-size: 13pt; margin: 22mm 0 14mm; }
	.cert-date { text-align: center; font-size: 12pt; margin-bottom: 22mm; }
	.cert-sign { text-align: center; font-size: 14pt; line-height: 2; }
	.cert-logo { display: inline-block; width: 95mm; height: auto; margin-bottom: 4mm; vertical-align: middle; }
	.seal { display: inline-grid; place-items: center; width: 16mm; height: 16mm; margin-left: 4mm; border: 2px solid #c92a2a; border-radius: 50%; color: #c92a2a; font-size: 10pt; }
	@media print {
		:global(.site-header), :global(.site-footer), .no-print { display: none !important; }
		:global(.site > main) { padding: 0 !important; max-width: none !important; }
		:global(body) { background: #fff !important; }
		.sheet-wrap { padding: 0; overflow: visible; }
		.sheet { box-shadow: none; border: 0; width: auto; min-height: 0; padding: 0; }
		.dt tr { break-inside: avoid; }
	}
	@page { size: A4; margin: 12mm; }
</style>
