<script lang="ts">
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';
	import { ageOf, officeTitle } from '#lib/registry/derive.ts';
	import {
		STATUS_KINDS, FAITH_KINDS, OFFICE_NAMES, OFFICE_STATUSES, CONSENT_KINDS, RELATIONS,
		type StatusKind, type FaithKind, type OfficeName, type OfficeStatus, type ConsentKind
	} from '#lib/registry/types.ts';

	const p = $derived(registry.person(page.params.id!));
	const s = $derived(p ? registry.summary(p) : null);
	const hh = $derived(p ? registry.householdOf(p.id) : undefined);
	const can = $derived(registry.perms.edit);

	const tabs = ['기본 정보', '세대', '신급·직분', '재적 이력', '소속', '심방', '메모·동의', '변경 이력'];
	let tab = $state('기본 정보');
	let editing = $state(false);
	let draft = $state<Record<string, any>>({});

	// 열람 기록 (접속기록에 남음)
	let logged = '';
	$effect(() => {
		if (p && logged !== p.id) {
			logged = p.id;
			registry.log('열람', p.name);
		}
	});

	const v = (x: unknown) => (x === null || x === undefined || x === '' ? '-' : String(x));
	const byDate = <T extends { event_date?: string | null; start_date?: string | null }>(xs: T[]) =>
		[...xs].sort((a, b) => (b.event_date ?? b.start_date ?? '').localeCompare(a.event_date ?? a.start_date ?? ''));
	const nn = (x: string) => (x === '' ? null : x);

	function startEdit() {
		draft = { ...p! };
		editing = true;
	}
	function saveEdit() {
		const keys = ['name', 'name_note', 'phone', 'gender', 'birth_date', 'birth_lunar', 'email', 'reg_no', 'address_zip', 'address1', 'address2', 'occupation', 'workplace', 'marital_status', 'wedding_date', 'previous_church', 'guide_name', 'sms_opt_out', 'faith_checked_on', 'note'];
		const patch: Record<string, any> = {};
		for (const k of keys) patch[k] = typeof draft[k] === 'string' ? nn(draft[k]) : draft[k];
		registry.updatePerson(p!.id, patch);
		editing = false;
	}

	// 이력 입력 폼 상태
	let st = $state<{ kind: StatusKind; date: string; reason: string; church: string }>({ kind: '등록', date: '', reason: '', church: '' });
	let fa = $state<{ kind: FaithKind; date: string; church: string; officiant: string }>({ kind: '세례', date: '', church: '', officiant: '' });
	let of = $state<{ office: OfficeName; rank: OfficeStatus; start: string; end: string }>({ office: '서리집사', rank: '시무', start: '', end: '' });
	let noteBody = $state('');
	let cs = $state<{ kind: ConsentKind; method: '서면' | '앱' | '구두'; guardian: string }>({ kind: '교적 등록', method: '서면', guardian: '' });
	let vs = $state({ date: new Date().toISOString().slice(0, 10), visitor: '', content: '', follow: '' });
	let af = $state({ org: '', role: '', start: '' });
	let grp = $state({ community: '', small_group: '' });
	let showMemo = $state(false);

	const myNotes = $derived(p ? registry.d.notes.filter((n) => n.person_id === p.id) : []);
	const memos = $derived(p ? registry.d.legacyMemos.filter((n) => n.person_id === p.id) : []);
	const consents = $derived(p ? registry.d.consents.filter((n) => n.person_id === p.id) : []);
	const logs = $derived(p ? registry.d.changeLog.filter((n) => n.person_id === p.id) : []);
	const visits = $derived(p ? registry.d.visits.filter((n) => n.person_id === p.id) : []);
	const affs = $derived(p ? registry.d.affiliations.filter((n) => n.person_id === p.id) : []);
	const gh = $derived(p ? registry.d.groupHistory.filter((n) => n.person_id === p.id) : []);
	const family = $derived(hh ? registry.membersOfHousehold(hh.id) : []);

	function openMemo() {
		showMemo = true;
		registry.log('디모데 메모 열람', p!.name);
	}
</script>

{#if p && s}
	<div class="row" style="justify-content:space-between">
		<h1>
			{p.name}{#if s.title}<small class="muted"> {s.title}</small>{/if}
			<span class="badge {s.status === '재적' ? '' : s.status === '보류' ? 'inactive' : 'transferred'}">{s.status}</span>
			<span class="badge">{s.faith}</span>
			{#if s.memberCert}<span class="tag now">앱 교인 인증 켜짐</span>{/if}
		</h1>
		<a class="btn ghost" href="/members">← 목록</a>
	</div>
	<p class="muted" style="margin-top:-.6rem">
		등록일 {s.registered ?? '미상'} · {s.community ? `${s.community} › ${s.smallGroup}` : '소그룹 없음'} · 교번 {p.reg_no ?? '미배정'}
		<span class="tag">위 값은 이력에서 자동 계산</span>
	</p>

	<div class="tabs">
		{#each tabs as t}<button class:on={tab === t} onclick={() => (tab = t)}>{t}</button>{/each}
	</div>

	{#if tab === '기본 정보'}
		<div class="card">
			<div class="row" style="justify-content:space-between"><h2>기본 정보</h2>
				{#if can && !editing}<button class="ghost" onclick={startEdit}>수정</button>{/if}
			</div>
			{#if !editing}
				<dl>
					<dt>이름</dt><dd>{p.name}{p.name_note ? ` (${p.name_note})` : ''} <span class="tag">앱 프로필</span></dd>
					<dt>휴대폰</dt><dd>{v(p.phone)} <span class="tag">앱 프로필</span></dd>
					<dt>성별</dt><dd>{p.gender === 'M' ? '남' : p.gender === 'F' ? '여' : '-'} <span class="tag">앱 프로필</span></dd>
					<dt>생년월일</dt><dd>{v(p.birth_date)}{p.birth_lunar ? ' (음력)' : ''} · 만 {ageOf(p.birth_date) ?? '-'}세</dd>
					<dt>이메일</dt><dd>{v(p.email)} <span class="tag">앱 프로필</span></dd>
					<dt>앱 가입</dt><dd>{p.has_account ? '가입' : '미가입'} <span class="tag">계산</span></dd>
					<dt>주소</dt><dd>{[p.address_zip, p.address1, p.address2].filter(Boolean).join(' ') || (hh?.address ? `${hh.address} (세대 주소)` : '-')}</dd>
					<dt>직업·직장</dt><dd>{v(p.occupation)} {p.workplace ? `/ ${p.workplace}` : ''}</dd>
					<dt>결혼</dt><dd>{v(p.marital_status)}{p.wedding_date ? ` · 결혼기념일 ${p.wedding_date}` : ''}</dd>
					<dt>이전 교회</dt><dd>{v(p.previous_church)}</dd>
					<dt>인도자</dt><dd>{#if p.guide_person_id}<a href="/{p.guide_person_id}">{registry.person(p.guide_person_id)?.name}</a>{:else}{v(p.guide_name)}{/if}</dd>
					<dt>신급 확인일</dt><dd>{v(p.faith_checked_on)}</dd>
					<dt>문자 수신 거부</dt><dd>{p.sms_opt_out ? '예' : '아니오'} <span class="tag part">칸만 있음</span></dd>
					<dt>비고</dt><dd>{v(p.note)}</dd>
				</dl>
			{:else}
				<form class="form" onsubmit={(e) => { e.preventDefault(); saveEdit(); }}>
					<label>이름<input bind:value={draft.name} required /></label>
					<label>동명이인 구분<input bind:value={draft.name_note} placeholder="1975년생" /></label>
					<label>휴대폰<input bind:value={draft.phone} /></label>
					<label>성별<select bind:value={draft.gender}><option value={null}>-</option><option value="M">남</option><option value="F">여</option></select></label>
					<label>생년월일<input type="date" bind:value={draft.birth_date} /></label>
					<label>음력 여부<select bind:value={draft.birth_lunar}><option value={false}>양력</option><option value={true}>음력</option></select></label>
					<label>이메일<input bind:value={draft.email} /></label>
					<label>교번<input bind:value={draft.reg_no} /></label>
					<label>우편번호<input bind:value={draft.address_zip} /></label>
					<label>주소<input bind:value={draft.address1} placeholder="비우면 세대 주소 사용" /></label>
					<label>상세주소<input bind:value={draft.address2} /></label>
					<label>직업<input bind:value={draft.occupation} /></label>
					<label>직장<input bind:value={draft.workplace} /></label>
					<label>결혼 여부<select bind:value={draft.marital_status}><option value={null}>-</option>{#each ['미혼', '기혼', '사별', '기타'] as m}<option>{m}</option>{/each}</select></label>
					<label>결혼기념일<input type="date" bind:value={draft.wedding_date} /></label>
					<label>이전 교회<input bind:value={draft.previous_church} /></label>
					<label>인도자 이름(비교인)<input bind:value={draft.guide_name} /></label>
					<label>신급 확인일<input type="date" bind:value={draft.faith_checked_on} /></label>
					<label>문자 수신 거부<select bind:value={draft.sms_opt_out}><option value={false}>아니오</option><option value={true}>예</option></select></label>
					<label class="wide">비고<textarea rows="2" bind:value={draft.note}></textarea></label>
					<div class="wide row"><button type="submit">저장 (변경 이력에 남음)</button><button type="button" class="ghost" onclick={() => (editing = false)}>취소</button></div>
				</form>
			{/if}
		</div>
		<p class="muted">주민등록번호는 교적에 두지 않습니다(기부금영수증용으로 나중에 따로 보관).</p>

	{:else if tab === '세대'}
		<div class="card">
			<h2>세대 {hh ? `${hh.no}` : ''}</h2>
			{#if hh}
				<p class="muted">{hh.zip} {hh.address} {hh.home_phone ? `· 집전화 ${hh.home_phone}` : ''}</p>
				<table class="sm"><thead><tr><th>관계(세대주 기준)</th><th>이름</th><th>교적 연결</th></tr></thead><tbody>
					{#each family as m}
						<tr><td>{m.relation}</td>
							<td>{#if m.person_id}<a href="/{m.person_id}">{registry.person(m.person_id)?.name}</a>{:else}{m.name}{m.birth_year ? ` (${m.birth_year}년생)` : ''}{/if}</td>
							<td>{m.person_id ? '교인' : '교인 아님 (이름·출생연도만)'}</td></tr>
					{/each}
				</tbody></table>
				<p><a href="/households/{hh.id}">세대 화면에서 세대원 추가·이동·분가 →</a></p>
			{:else}
				<p class="muted">아직 세대가 없습니다. 디모데 가져오기와 담당자 입력으로 채우는 중입니다.</p>
			{/if}
		</div>

	{:else if tab === '신급·직분'}
		<div class="card">
			<h2>신급 이력 <span class="tag now">지금: {s.faith}</span></h2>
			<table class="sm"><thead><tr><th>구분</th><th>날짜</th><th>받은 교회</th><th>집례자</th></tr></thead><tbody>
				{#each byDate(registry.faithOf(p.id)) as e}<tr><td>{e.kind}</td><td>{e.event_date ?? '미상'}</td><td>{e.church ?? '본 교회'}</td><td>{v(e.officiant)}</td></tr>
				{:else}<tr><td colspan="4" class="muted">기록 없음{p.faith_checked_on ? ` (신급 확인일 ${p.faith_checked_on} → 원입교인)` : ' → 미확인'}</td></tr>{/each}
			</tbody></table>
			{#if can}
				<form class="form" style="margin-top:.7rem" onsubmit={(e) => { e.preventDefault(); registry.addFaith({ person_id: p.id, kind: fa.kind, event_date: nn(fa.date), church: nn(fa.church), officiant: nn(fa.officiant), note: null }); fa.date = ''; }}>
					<label>구분<select bind:value={fa.kind}>{#each FAITH_KINDS as k}<option>{k}</option>{/each}</select></label>
					<label>날짜<input type="date" bind:value={fa.date} /></label>
					<label>받은 교회<input bind:value={fa.church} placeholder="비우면 본 교회" /></label>
					<label>집례자<input bind:value={fa.officiant} /></label>
					<div class="wide"><button type="submit">신급 기록 추가</button></div>
				</form>
			{/if}
		</div>
		<div class="card">
			<h2>직분 이력 {#if s.office}<span class="tag now">지금 호칭: {s.title}</span>{/if}</h2>
			<table class="sm"><thead><tr><th>직분</th><th>신분</th><th>시작</th><th>끝</th></tr></thead><tbody>
				{#each byDate(registry.officesOf(p.id)) as t}<tr><td>{t.office}</td><td>{t.rank_status}</td><td>{t.start_date ?? '미상'}</td><td>{t.end_date ?? '(지금)'}</td></tr>
				{:else}<tr><td colspan="4" class="muted">직분 이력 없음 (호칭은 건드리지 않음)</td></tr>{/each}
			</tbody></table>
			{#if can}
				<form class="form" style="margin-top:.7rem" onsubmit={(e) => { e.preventDefault(); registry.addOffice({ person_id: p.id, office: of.office, rank_status: of.rank, start_date: nn(of.start), end_date: nn(of.end), note: null }); of.start = ''; of.end = ''; }}>
					<label>직분<select bind:value={of.office}>{#each OFFICE_NAMES as o}<option>{o}</option>{/each}</select></label>
					<label>신분<select bind:value={of.rank}>{#each OFFICE_STATUSES as o}<option>{o}</option>{/each}</select></label>
					<label>시작일<input type="date" bind:value={of.start} /></label>
					<label>종료일<input type="date" bind:value={of.end} /></label>
					<div class="wide"><button type="submit">직분 기록 추가</button> <span class="muted">호칭 미리보기: {officeTitle({ office: of.office, rank_status: of.rank })}</span></div>
				</form>
			{/if}
		</div>

	{:else if tab === '재적 이력'}
		<div class="card">
			<h2>재적 이력 <span class="tag now">지금: {s.status}</span></h2>
			<table class="sm"><thead><tr><th>기록</th><th>날짜</th><th>사유</th><th>교회(전입·전출)</th></tr></thead><tbody>
				{#each byDate(registry.statusOf(p.id)) as e}<tr><td>{e.kind}</td><td>{e.event_date ?? '미상'}</td><td>{v(e.reason)}</td><td>{v(e.church)}</td></tr>
				{:else}<tr><td colspan="4" class="muted">기록 없음</td></tr>{/each}
			</tbody></table>
			<p class="muted">등록·전입·복적 → 재적(인증 켜짐) · 보류 → 보류(켜짐) · 전출·별세·제적 → 꺼짐. 날짜를 모르면 비워 둡니다. 전출·별세·제적 5년 뒤 인적사항은 자동으로 지워집니다.</p>
			{#if can}
				<form class="form" onsubmit={(e) => { e.preventDefault(); registry.addStatus({ person_id: p.id, kind: st.kind, event_date: nn(st.date), reason: nn(st.reason), church: nn(st.church) }); st.date = ''; st.reason = ''; }}>
					<label>기록<select bind:value={st.kind}>{#each STATUS_KINDS as k}<option>{k}</option>{/each}</select></label>
					<label>날짜<input type="date" bind:value={st.date} /></label>
					<label>사유<input bind:value={st.reason} /></label>
					<label>교회<input bind:value={st.church} /></label>
					<div class="wide"><button type="submit">재적 기록 추가</button></div>
				</form>
			{/if}
		</div>

	{:else if tab === '소속'}
		<div class="card">
			<h2>공동체·소그룹 <span class="tag">출석부 자료 그대로</span></h2>
			<p>{s.community ? `${s.community} › ${s.smallGroup}` : '소속 없음'}</p>
			<p class="muted">실제 시스템은 지금 소속만 보이고 이동 이력은 남지 않습니다.</p>
			<h2>소그룹 이동 이력 <span class="tag new">새 자료 필요</span></h2>
			<table class="sm"><thead><tr><th>소그룹</th><th>시작</th><th>끝</th></tr></thead><tbody>
				{#each gh as g}<tr><td>{g.small_group}</td><td>{g.start_date ?? '미상'}</td><td>{g.end_date ?? '(지금)'}</td></tr>{:else}<tr><td colspan="3" class="muted">이동 이력 없음</td></tr>{/each}
				{#if s.smallGroup}<tr><td>{s.smallGroup}</td><td>-</td><td>(지금)</td></tr>{/if}
			</tbody></table>
			{#if can}
				<form class="form" style="margin-top:.7rem" onsubmit={(e) => { e.preventDefault(); registry.setGroup(p.id, grp.community, grp.small_group); grp.community = ''; grp.small_group = ''; }}>
					<label>공동체<input bind:value={grp.community} required placeholder="열매 공동체" /></label>
					<label>소그룹<input bind:value={grp.small_group} required placeholder="훈남" /></label>
					<div class="wide"><button type="submit">소그룹 이동(데모)</button></div>
				</form>
			{/if}
		</div>
		<div class="card">
			<h2>선교회·부서·찬양대·봉사 소속 <span class="tag new">새 자료 필요</span></h2>
			<table class="sm"><thead><tr><th>조직</th><th>역할</th><th>시작</th><th>끝</th></tr></thead><tbody>
				{#each affs as a}<tr><td>{a.org}</td><td>{v(a.role)}</td><td>{a.start_date ?? '미상'}</td><td>{a.end_date ?? '(지금)'}</td></tr>{:else}<tr><td colspan="4" class="muted">소속 없음</td></tr>{/each}
			</tbody></table>
			{#if can}
				<form class="form" style="margin-top:.7rem" onsubmit={(e) => { e.preventDefault(); registry.addAffiliation({ person_id: p.id, org: af.org, role: nn(af.role), start_date: nn(af.start), end_date: null }); af.org = ''; af.role = ''; }}>
					<label>조직<input bind:value={af.org} required placeholder="찬양대" /></label>
					<label>역할<input bind:value={af.role} /></label>
					<label>시작일<input type="date" bind:value={af.start} /></label>
					<div class="wide"><button type="submit">소속 추가</button></div>
				</form>
			{/if}
		</div>

	{:else if tab === '심방'}
		<div class="card">
			<h2>심방 기록 <span class="tag new">새 자료 필요</span></h2>
			<p class="muted">실제 시스템은 지금 심방을 담당자 메모에 적습니다. 날짜·심방자·내용·후속 조치 칸과 '누가 볼지'를 시험해 보는 화면입니다.</p>
			{#if registry.perms.visit}
				{#each byDate(visits.map((x) => ({ ...x, event_date: x.visit_date }))) as x}
					<div style="margin-bottom:.6rem"><b>{x.visit_date}</b> · {x.visitor}<br />{x.content}{#if x.follow_up}<br /><span class="muted">후속 조치: {x.follow_up}</span>{/if}</div>
				{:else}<p class="muted">심방 기록이 없습니다.</p>{/each}
				{#if can}
					<form class="form" onsubmit={(e) => { e.preventDefault(); registry.addVisit({ person_id: p.id, visit_date: vs.date, visitor: vs.visitor, content: vs.content, follow_up: nn(vs.follow) }); vs.content = ''; vs.follow = ''; }}>
						<label>날짜<input type="date" bind:value={vs.date} required /></label>
						<label>심방자<input bind:value={vs.visitor} required /></label>
						<label class="wide">내용<textarea rows="2" bind:value={vs.content} required></textarea></label>
						<label class="wide">후속 조치<input bind:value={vs.follow} /></label>
						<div class="wide"><button type="submit">심방 기록 추가</button></div>
					</form>
				{/if}
			{:else}
				<div class="warn">심방 권한이 꺼져 있어 볼 수 없습니다. (위 '내 교적 권한'에서 '심방'을 켜 보세요)</div>
			{/if}
		</div>

	{:else if tab === '메모·동의'}
		<div class="card">
			<h2>담당자 메모 <span class="tag">교적 권한자 모두 열람</span></h2>
			{#each myNotes as n}<div style="margin-bottom:.5rem">{n.body}<br /><span class="muted">{n.author} · {n.created_at}</span></div>{:else}<p class="muted">메모 없음</p>{/each}
			{#if can}
				<form class="row" onsubmit={(e) => { e.preventDefault(); if (noteBody.trim()) { registry.addNote(p.id, noteBody.trim()); noteBody = ''; } }}>
					<input style="flex:1" bind:value={noteBody} placeholder="메모 입력" /><button type="submit">추가</button>
				</form>
			{/if}
		</div>
		<div class="card">
			<h2>디모데 메모 <span class="tag">심방 권한자만 · 열 때마다 접속기록</span></h2>
			{#if !registry.perms.visit}
				<div class="warn">심방 권한이 필요합니다.</div>
			{:else if memos.length === 0}
				<p class="muted">옛 디모데 메모 없음</p>
			{:else if !showMemo}
				<button class="ghost" onclick={openMemo}>열어 보기 (접속기록에 남음)</button>
			{:else}
				{#each memos as m}<div>{m.body}</div>{/each}
			{/if}
		</div>
		<div class="card">
			<h2>동의 기록</h2>
			<table class="sm"><thead><tr><th>종류</th><th>처리방침 판</th><th>동의일</th><th>방법</th><th>보호자</th><th>철회일</th><th></th></tr></thead><tbody>
				{#each consents as c}<tr><td>{c.kind}</td><td>{c.policy_version}</td><td>{c.consent_date ?? '-'}</td><td>{c.method}</td><td>{v(c.guardian_name)}</td><td>{v(c.revoked_on)}</td>
					<td>{#if can && !c.revoked_on}<button class="ghost" onclick={() => registry.revokeConsent(c.id)}>철회</button>{/if}</td></tr>
				{:else}<tr><td colspan="7" class="muted">동의 기록 없음</td></tr>{/each}
			</tbody></table>
			{#if can}
				<form class="form" style="margin-top:.7rem" onsubmit={(e) => { e.preventDefault(); registry.addConsent({ person_id: p.id, kind: cs.kind, policy_version: '2026-01', consent_date: new Date().toISOString().slice(0, 10), method: cs.method, guardian_name: nn(cs.guardian), revoked_on: null }); cs.guardian = ''; }}>
					<label>종류<select bind:value={cs.kind}>{#each CONSENT_KINDS as k}<option>{k}</option>{/each}</select></label>
					<label>방법<select bind:value={cs.method}>{#each ['서면', '앱', '구두'] as k}<option>{k}</option>{/each}</select></label>
					<label>보호자 이름(14세 미만)<input bind:value={cs.guardian} /></label>
					<div class="wide"><button type="submit">동의 기록 추가</button></div>
				</form>
			{/if}
		</div>

	{:else if tab === '변경 이력'}
		<div class="card">
			<h2>변경 이력</h2>
			<p class="muted">수정하면 바뀜 전후 값이 남습니다.</p>
			<table class="sm"><thead><tr><th>시각</th><th>수정자</th><th>항목</th><th>전</th><th>후</th></tr></thead><tbody>
				{#each logs as l}<tr><td>{l.at}</td><td>{l.by}</td><td>{l.field}</td><td>{v(l.before)}</td><td>{v(l.after)}</td></tr>{:else}<tr><td colspan="5" class="muted">변경 이력 없음</td></tr>{/each}
			</tbody></table>
		</div>
	{/if}
{:else}
	<p>교적을 찾을 수 없습니다. <a href="/members">목록으로</a></p>
{/if}
