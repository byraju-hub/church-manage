<script lang="ts">
	// 교적 화면 공통 틀: 카카오 로그인, 상단 메뉴, 휴대폰 아래 메뉴, 회원 바꿔 보기
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';
	import type { AppUser } from '#lib/registry/types.ts';
	import { formatMobile } from '#lib/registry/derive.ts';

	let { children } = $props();

	// 로그인: 카카오로 회원가입·로그인 → 최고관리자가 회원 목록에서 승인하고 등급(A·B·C) 지정 → 사용
	// 30분 동안 쓰지 않으면 로그아웃
	// [실제 시스템] 홈페이지와 같은 카카오 로그인을 씁니다. Supabase Auth 의 Kakao 공급자:
	//   supabase.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo: `${location.origin}/auth/callback` } })
	//   카카오 개발자 콘솔에 Redirect URI(…supabase.co/auth/v1/callback) 등록, 동의 항목(닉네임·이메일) 설정 필요.
	//   아래 '카카오 계정 고르기' 창은 프로토타입 시연용입니다.
	const IDLE_MS = 30 * 60 * 1000;
	let mode = $state<'login' | 'kakao' | 'signup' | 'sent'>('login');
	let su = $state({ name: '', nickname: '', email: '', phone: '' });
	let loginMsg = $state('');
	let last = Date.now();
	let menuOpen = $state(false);
	let userOpen = $state(false);
	let scrollY = $state(0);
	// 스크롤을 내리는 만큼 상단바가 조금씩 줄어듦 (맨 위 0 → 160px 내리면 1 = 지금 높이, 최소)
	// 단계로 바뀌지 않고 스크롤 위치를 그대로 따라가서 자연스럽게 작아짐
	const SHRINK_PX = 160;
	const hbP = $derived(Math.round(Math.min(1, Math.max(0, scrollY / SHRINK_PX)) * 100) / 100);
	const toTop = () => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
	const me = $derived(registry.me);
	const unlocked = $derived(!!me && me.status === '사용');

	onMount(() => {
		const touch = () => (last = Date.now());
		const outside = (e: MouseEvent) => {
			if (!(e.target as HTMLElement).closest?.('.perm')) userOpen = false;
		};
		window.addEventListener('click', touch);
		window.addEventListener('click', outside);
		window.addEventListener('keydown', touch);
		const t = setInterval(() => {
			if (unlocked && Date.now() - last > IDLE_MS) logout();
		}, 30000);
		return () => {
			window.removeEventListener('click', touch);
			window.removeEventListener('click', outside);
			window.removeEventListener('keydown', touch);
			clearInterval(t);
		};
	});

	// 화면을 옮기면 모바일 메뉴를 닫음
	$effect(() => {
		page.url.pathname;
		menuOpen = false;
	});

	function logout() {
		userOpen = false;
		registry.logout();
		mode = 'login';
	}
	// (시연) 카카오 계정으로 로그인
	function kakaoLogin(u: AppUser) {
		loginMsg = '';
		if (u.status === '승인 대기') { loginMsg = `${u.name}님은 가입 신청이 접수되어 최고관리자의 승인을 기다리고 있습니다.`; mode = 'login'; }
		else if (u.status === '정지') { loginMsg = '사용이 정지된 회원입니다. 최고관리자에게 문의해 주세요.'; mode = 'login'; }
		else { last = Date.now(); registry.login(u.id); }
	}
	function signUp(e: SubmitEvent) {
		e.preventDefault();
		if (!su.name.trim()) return;
		registry.signUpKakao(su.name, su.nickname, su.email, su.phone);
		su = { name: '', nickname: '', email: '', phone: '' };
		mode = 'sent';
	}
	function switchUser(id: string) {
		registry.login(id);
		userOpen = false;
	}
	const roleOf = (u: AppUser) => (u.is_super ? '최고관리자' : (registry.gradeDef(u.grade)?.name ?? '등급 없음'));

	// 상단 메뉴 ('교적 프로그램 구조' 문서 순서)
	type Item = { href: string; label: string; hint?: string };
	const memberMenu: Item[] = [
		{ href: '/members', label: '교인 목록', hint: '기본 · 복수 · 항목별 검색' },
		{ href: '/new', label: '교인 등록', hint: '등록 카드 촬영 후 등록 가능' },
		{ href: '/newcomers', label: '새가족 정착', hint: '등록 → 교육 → 수료 → 소그룹' },
		{ href: '/households', label: '세대 목록', hint: '세대원 · 분가' }
	];
	const commMenu: Item[] = [
		{ href: '/communities', label: '공동체 편성표', hint: '인도자 · 모임 장소 · 출석' },
		{ href: '/communities/roster', label: '소그룹별 명단', hint: '각 소그룹 명단 · 개인 출석률' }
	];
	const statMenu: Item[] = [
		{ href: '/stats', label: '통계', hint: '출석 · 소그룹 · 임직 · 세례' },
		{ href: '/reports', label: '명단', hint: '생일 · 직분자 · 세례 대상자' },
		{ href: '/documents', label: '문서 출력', hint: '교적부 · 증명서 · 요람 · PDF' }
	];
	const adminMenu: Item[] = [
		{ href: '/admin', label: '회원 · 권한', hint: '가입 승인 · 등급 · 접속기록' },
		{ href: '/candidates', label: '확인 목록', hint: '중복 · 미등록 확인' },
		{ href: '/settings', label: '설정', hint: '교인구분 · 소그룹 · 조직표' }
	];
	const path = $derived(page.url.pathname);
	const inMenu = (items: Item[]) => items.some((i) => path === i.href || path.startsWith(i.href + '/'));
	// 교적 카드(/p10 같은 주소)는 '교적'에 속한 화면으로 봄
	const known = ['/', '/members', '/new', '/newcomers', '/households', '/candidates', '/communities', '/attendance', '/visits', '/orgs', '/stats', '/reports', '/documents', '/admin', '/settings'];
	const isCard = $derived(path !== '/' && !known.some((p) => path === p || path.startsWith(p + '/')));
	const showAdmin = $derived(registry.perms.admin || registry.isSuper);
</script>

<svelte:window bind:scrollY />

{#snippet kakaoIcon()}
	<svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true"><path fill="#191919" d="M12 3C6.48 3 2 6.5 2 10.82c0 2.8 1.88 5.25 4.7 6.63-.15.53-.97 3.4-1 3.62 0 0-.02.17.09.24.11.06.24.01.24.01.31-.04 3.62-2.37 4.19-2.77.58.08 1.17.12 1.78.12 5.52 0 10-3.5 10-7.82C22 6.5 17.52 3 12 3z" /></svg>
{/snippet}

<div class="site">
	<header class="site-header" class:compact={hbP >= 1} style:--hb-p={hbP}>
		<div class="bar">
			<a class="brand" href="/">
				<img class="logo" src="/logo.png" alt="" width="38" height="38" />
				<span><b>부평동부교회 교적 관리</b></span>
			</a>

			{#if unlocked}
				<button class="burger" type="button" aria-label="메뉴 열기" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
					<span></span><span></span><span></span>
				</button>

				<nav class="main-nav" class:open={menuOpen} aria-label="주 메뉴">
					<a href="/" class:active={path === '/'}>대시보드</a>

					{#snippet dd(label: string, items: Item[], active: boolean)}
						<div class="dd" class:active>
							<!-- 메뉴 이름을 누르면 첫 번째 하위 메뉴로 이동 (마우스를 올리면 하위 메뉴가 펼쳐짐) -->
							<a href={items[0].href} class="dd-btn" aria-haspopup="true">
								{label}
								<svg width="10" height="10" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
							</a>
							<div class="dd-menu">
								{#each items as m}
									<a href={m.href} class:active={path === m.href}><b>{m.label}</b>{#if m.hint}<small>{m.hint}</small>{/if}</a>
								{/each}
							</div>
						</div>
					{/snippet}
					{@render dd('교적', memberMenu, inMenu(memberMenu) || isCard)}
					{@render dd('공동체', commMenu, path.startsWith('/communities'))}
					<a href="/attendance" class:active={path.startsWith('/attendance')}>출석</a>
					{#if registry.perms.visit}<a href="/visits" class:active={path.startsWith('/visits')}>심방</a>{/if}
					<a href="/orgs" class:active={path.startsWith('/orgs')}>조직</a>
					{@render dd('통계', statMenu, inMenu(statMenu))}
					{#if showAdmin}{@render dd('관리자', adminMenu, inMenu(adminMenu))}{/if}

					<div class="nav-tools">
						<div class="perm">
							<button type="button" class="tool-btn" aria-expanded={userOpen} onclick={() => (userOpen = !userOpen)}>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21v-1a6 6 0 0112 0v1" /></svg>
								{me?.name} <small class="role">{me ? roleOf(me) : ''}</small>
							</button>
							{#if userOpen}
								<div class="perm-panel">
									<b>{me?.name}</b> <span class="tag">{me ? roleOf(me) : ''}</span>
									<p class="muted">카카오 로그인 · 등급은 최고관리자가 '관리자 › 회원 · 권한'에서 정합니다.</p>
									<hr />
									<b style="font-size:.85rem">다른 회원으로 보기 (시험용)</b>
									<p class="muted">등급마다 보이는 화면이 어떻게 다른지 확인할 수 있습니다.</p>
									{#each registry.d.users.filter((u) => u.status === '사용') as u (u.id)}
										<button type="button" class="ghost sm user-sw" class:on={u.id === me?.id} onclick={() => switchUser(u.id)}>{u.name} <small>{roleOf(u)}</small></button>
									{/each}
									<hr />
									<button type="button" class="ghost sm" onclick={() => { if (confirm('교적 샘플 데이터를 처음 상태로 되돌립니다.')) registry.reset(); }}>교적 데이터 초기화</button>
								</div>
							{/if}
						</div>
						<button type="button" class="tool-btn" onclick={logout}>
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><path d="M10 17l5-5-5-5M15 12H3" /></svg>
							로그아웃
						</button>
					</div>
				</nav>
			{/if}
		</div>
	</header>

	<main>
		{#if !unlocked}
			<div class="card lock">
				<img src="/logo.png" alt="" width="64" height="64" style="display:block;margin:0 auto .8rem;border-radius:18px;box-shadow:0 6px 18px rgba(43,62,149,.25)" />
				{#if mode === 'login'}
					<h2>부평동부교회 교적 관리</h2>
					<p class="muted">홈페이지와 같은 카카오 계정으로 로그인합니다.<br />처음 로그인 시 자동으로 가입 신청이 되고,<br />최고 관리자의 승인 후 사용할 수 있습니다.</p>
					<button type="button" class="kakao" onclick={() => { loginMsg = ''; mode = 'kakao'; }}>{@render kakaoIcon()} 카카오로 로그인</button>
					{#if loginMsg}<p style="color:#a83c10;font-size:.88rem;margin-top:.8rem">{loginMsg}</p>{/if}
					<p class="muted" style="font-size:.78rem;margin-top:1rem">로그인하면 교적 열람 기록이 남습니다.</p>
				{:else if mode === 'kakao'}
					<div class="kakao-sheet">
						<div class="kakao-top">{@render kakaoIcon()} <b>kakao</b> <span class="tag part">시연</span></div>
						<p style="margin:.6rem 0 .3rem;font-weight:700">계정을 선택하세요</p>
						<p class="muted" style="font-size:.8rem;margin:0 0 .6rem">실제로는 카카오 로그인 창이 열립니다. 여기서는 가상의 카카오 계정을 고릅니다.</p>
						{#each registry.d.users as u (u.id)}
							<button type="button" class="kakao-acc" onclick={() => kakaoLogin(u)}>
								<span class="avatar warm" style="width:34px;height:34px">{u.name.slice(0, 1)}</span>
								<span class="grow"><b>{u.kakao_nickname ?? u.name}</b><small>{u.name}{u.status !== '사용' ? ` · ${u.status}` : ` · ${roleOf(u)}`}</small></span>
							</button>
						{/each}
						<button type="button" class="kakao-acc new" onclick={() => (mode = 'signup')}>＋ 새 카카오 계정으로 가입 신청</button>
						<p><button type="button" class="ghost sm" onclick={() => (mode = 'login')}>취소</button></p>
					</div>
				{:else if mode === 'signup'}
					<div class="kakao-sheet">
						<div class="kakao-top">{@render kakaoIcon()} <b>kakao</b> <span class="tag part">시연</span></div>
						<p style="margin:.6rem 0 .2rem;font-weight:700">부평동부교회 교적 관리 서비스에 동의</p>
						<p class="muted" style="font-size:.8rem;margin:0 0 .6rem">카카오가 프로필 이름·이메일을 교회에 전달합니다. 실명은 교회가 확인할 수 있게 적어 주세요.</p>
						<form onsubmit={signUp}>
							<input bind:value={su.name} placeholder="실명 (필수)" required style="margin:.25rem 0" />
							<input bind:value={su.nickname} placeholder="카카오 프로필 이름" style="margin:.25rem 0" />
							<input type="email" bind:value={su.email} placeholder="카카오 이메일 (선택)" style="margin:.25rem 0" />
							<input value={su.phone} oninput={(e) => (e.currentTarget.value = su.phone = formatMobile(e.currentTarget.value))} inputmode="numeric" maxlength="13" placeholder="휴대폰 (선택)" style="margin:.25rem 0" />
							<button type="submit" class="kakao" style="margin-top:.5rem">동의하고 가입 신청</button>
						</form>
						<p><button type="button" class="ghost sm" onclick={() => (mode = 'kakao')}>돌아가기</button></p>
					</div>
				{:else}
					<h2>가입 신청이 접수되었습니다</h2>
					<p class="muted">최고관리자가 회원 목록에서 승인하고 등급을 정하면 카카오로 로그인해 쓸 수 있습니다.</p>
					<p><button type="button" class="ghost" onclick={() => (mode = 'login')}>처음 화면으로</button></p>
				{/if}
			</div>
		{:else}
			{#if registry.saveError}<div class="warn">{registry.saveError}</div>{/if}
			{@render children()}
		{/if}
	</main>

	{#if unlocked}
		<!-- 휴대폰 아래쪽 메뉴: 자주 쓰는 화면을 엄지로 바로 -->
		<nav class="tabbar" aria-label="빠른 메뉴">
			<a href="/" class:on={path === '/'}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-8 9 8" /><path d="M5 10v10h14V10" /></svg>홈</a>
			<a href="/members" class:on={path.startsWith('/members') || isCard}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="4" /><path d="M2 21v-1a7 7 0 0114 0v1" /><path d="M17 4a4 4 0 010 8M22 21v-1a6 6 0 00-4-5.6" /></svg>교인</a>
			{#if registry.perms.edit}<a href="/new" class:on={path === '/new'}><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></svg>등록</a>{/if}
			{#if registry.perms.visit}<a href="/visits" class:on={path.startsWith('/visits')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V9l8-6 8 6v12" /><path d="M9 21v-6h6v6" /></svg>심방</a>{/if}
			<button type="button" class:on={menuOpen} onclick={() => (menuOpen = !menuOpen)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>메뉴</button>
		</nav>
	{/if}

	{#if scrollY > 400}
		<!-- 스크롤을 내리면 오른쪽 아래에 '맨 위로' 버튼 -->
		<button type="button" class="to-top" onclick={toTop} aria-label="맨 위로" title="맨 위로">
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5" /><path d="M5 12l7-7 7 7" /></svg>
		</button>
	{/if}

	<footer class="site-footer">
		<div class="foot">
			<div class="foot-brand">
				<b>부평동부교회 교적 관리</b>
				<span>(가상 샘플 데이터로 동작하며 실제 DB에 연결되어 있지 않습니다.)</span>
			</div>
			<p class="muted">ⓒ 2026 부평동부교회. All Rights Reserved.</p>
		</div>
	</footer>
</div>

<style>
	.to-top {
		position: fixed; right: 1.2rem; bottom: calc(1.2rem + env(safe-area-inset-bottom)); z-index: 35;
		display: grid; place-items: center; width: 46px; height: 46px; padding: 0; border-radius: 50%;
		color: #fff; background: var(--primary); border: 0; box-shadow: var(--shadow-md);
	}
	.to-top svg { width: 22px; height: 22px; fill: none; stroke: currentColor; stroke-width: 2.4; stroke-linecap: round; stroke-linejoin: round; }
	@media (max-width: 960px) {
		.to-top { bottom: calc(4.6rem + env(safe-area-inset-bottom)); right: 0.9rem; width: 42px; height: 42px; }
	}
	.kakao { width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; padding: 0.75rem 1rem; font-size: 0.98rem; font-weight: 700; color: #191919; background: #fee500; border: 0; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12); }
	.kakao:hover { background: #fada0a; color: #191919; box-shadow: 0 6px 16px rgba(0, 0, 0, 0.16); filter: none; }
	.kakao-sheet { text-align: left; }
	.kakao-top { display: flex; align-items: center; gap: 0.4rem; padding-bottom: 0.6rem; border-bottom: 1px solid var(--line); }
	.kakao-acc { display: flex; align-items: center; justify-content: flex-start; gap: 0.7rem; width: 100%; text-align: left; margin: 0.25rem 0; padding: 0.5rem 0.6rem; font-weight: 500; color: var(--text); background: #fff; border: 1px solid var(--line); border-radius: 12px; box-shadow: none; }
	.kakao-acc:hover { background: #fffbe0; border-color: #f2d600; color: var(--text); transform: none; box-shadow: none; filter: none; }
	.kakao-acc .grow { display: flex; flex-direction: column; }
	.kakao-acc small { color: var(--muted); font-size: 0.76rem; }
	.kakao-acc.new { justify-content: center; font-weight: 700; color: #6b5800; border-style: dashed; }
</style>
