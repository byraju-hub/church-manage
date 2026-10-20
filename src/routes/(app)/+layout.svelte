<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { registry } from '#lib/registry/store.svelte.ts';

	let { children } = $props();

	// 교적 전용 비밀번호 (프로토타입 데모: 0000). 5번 틀리면 잠김, 30분 미사용 시 다시 잠김
	const PIN = '0000';
	const IDLE_MS = 30 * 60 * 1000;
	let unlocked = $state(false);
	let locked = $state(false);
	let fails = $state(0);
	let pin = $state('');
	let last = Date.now();
	let menuOpen = $state(false);
	let permOpen = $state(false);

	onMount(() => {
		try {
			unlocked = sessionStorage.getItem('reg-unlocked') === '1';
			locked = localStorage.getItem('reg-locked') === '1';
		} catch {}
		const touch = () => (last = Date.now());
		const outside = (e: MouseEvent) => {
			if (!(e.target as HTMLElement).closest?.('.perm')) permOpen = false;
		};
		window.addEventListener('click', touch);
		window.addEventListener('click', outside);
		window.addEventListener('keydown', touch);
		const t = setInterval(() => {
			if (unlocked && Date.now() - last > IDLE_MS) lock();
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

	function lock() {
		unlocked = false;
		permOpen = false;
		try { sessionStorage.removeItem('reg-unlocked'); } catch {}
	}
	function submit(e: SubmitEvent) {
		e.preventDefault();
		if (pin === PIN) {
			unlocked = true; fails = 0; last = Date.now();
			try { sessionStorage.setItem('reg-unlocked', '1'); } catch {}
		} else if (++fails >= 5) {
			locked = true;
			try { localStorage.setItem('reg-locked', '1'); } catch {}
		}
		pin = '';
	}
	function adminUnlock() {
		locked = false; fails = 0;
		try { localStorage.removeItem('reg-locked'); } catch {}
	}

	// 상단 메뉴 ('교적 프로그램 구조' 문서 순서)
	type Item = { href: string; label: string; hint?: string };
	const memberMenu: Item[] = [
		{ href: '/members', label: '교인 목록', hint: '기본 · 복수 · 항목별 검색' },
		{ href: '/new', label: '교인 등록', hint: '등록카드 순서로 입력' },
		{ href: '/households', label: '세대', hint: '세대원 · 분가' },
		{ href: '/candidates', label: '확인 목록', hint: '중복 · 미등록 확인' }
	];
	const commMenu: Item[] = [
		{ href: '/communities', label: '공동체 편성표', hint: '인도자 · 소그룹 장소' },
		{ href: '/attendance', label: '주일 출석 등록', hint: '공동체 · 소그룹별' }
	];
	const statMenu: Item[] = [
		{ href: '/stats', label: '통계', hint: '출석 · 소그룹 · 임직 · 세례' },
		{ href: '/reports', label: '명단', hint: '생일 · 직분자 · 세례 대상자' }
	];
	const adminMenu: Item[] = [
		{ href: '/admin', label: '권한 · 기록', hint: '접속기록 · 권한' },
		{ href: '/settings', label: '설정', hint: '교인구분 · 소그룹 · 조직표' },
		{ href: '/ideas', label: '기능 아이디어', hint: '안내서 기능 표' }
	];
	const path = $derived(page.url.pathname);
	const inMenu = (items: Item[]) => items.some((i) => path === i.href || path.startsWith(i.href + '/'));
	// 교적 카드(/p10 같은 주소)는 '교적'에 속한 화면으로 봄
	const known = ['/', '/members', '/new', '/households', '/candidates', '/communities', '/attendance', '/visits', '/orgs', '/stats', '/reports', '/admin', '/settings', '/ideas'];
	const isCard = $derived(path !== '/' && !known.some((p) => path === p || path.startsWith(p + '/')));
	const setPerm = (key: keyof typeof registry.perms, v: boolean) => registry.setPerms({ ...registry.perms, [key]: v });
</script>

<div class="site">
	<header class="site-header">
		<div class="bar">
			<a class="brand" href="/">
				<span class="logo">
					<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18M6 9h12" /></svg>
				</span>
				<span><b>부평동부교회 교적 관리</b><small>프로토타입</small></span>
			</a>

			{#if unlocked}
				<button class="burger" type="button" aria-label="메뉴 열기" aria-expanded={menuOpen} onclick={() => (menuOpen = !menuOpen)}>
					<span></span><span></span><span></span>
				</button>

				<nav class="main-nav" class:open={menuOpen} aria-label="주 메뉴">
					<a href="/" class:active={path === '/'}>대시보드</a>

					{#snippet dd(label: string, items: Item[], active: boolean)}
						<div class="dd" class:active>
							<button type="button" class="dd-btn" aria-haspopup="true">
								{label}
								<svg width="10" height="10" viewBox="0 0 12 8" aria-hidden="true"><path d="M1 1.5l5 5 5-5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" /></svg>
							</button>
							<div class="dd-menu">
								{#each items as m}
									<a href={m.href} class:active={path === m.href}><b>{m.label}</b><small>{m.hint}</small></a>
								{/each}
							</div>
						</div>
					{/snippet}
					{@render dd('교적', memberMenu, inMenu(memberMenu) || isCard)}
					{@render dd('공동체', commMenu, inMenu(commMenu))}
					<a href="/visits" class:active={path.startsWith('/visits')}>심방</a>
					<a href="/orgs" class:active={path.startsWith('/orgs')}>조직</a>
					{@render dd('통계', statMenu, inMenu(statMenu))}
					{@render dd('관리자', adminMenu, inMenu(adminMenu))}

					<div class="nav-tools">
						<div class="perm">
							<button type="button" class="tool-btn" aria-expanded={permOpen} onclick={() => (permOpen = !permOpen)}>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6z" /><path d="M9 12l2 2 4-4" /></svg>
								권한 시험
							</button>
							{#if permOpen}
								<div class="perm-panel">
									<b>내 교적 권한 (시험용)</b>
									<p class="muted">기본은 열람입니다. 켜고 끄면서 화면이 어떻게 달라지는지 볼 수 있습니다.</p>
									<label><input type="checkbox" checked={registry.perms.edit} onchange={(e) => setPerm('edit', e.currentTarget.checked)} />수정</label>
									<label><input type="checkbox" checked={registry.perms.export} onchange={(e) => setPerm('export', e.currentTarget.checked)} />내려받기</label>
									<label><input type="checkbox" checked={registry.perms.visit} onchange={(e) => setPerm('visit', e.currentTarget.checked)} />심방</label>
									<label><input type="checkbox" checked={registry.perms.admin} onchange={(e) => setPerm('admin', e.currentTarget.checked)} />사이트 관리자</label>
									<hr />
									<button type="button" class="ghost sm" onclick={() => { if (confirm('교적 샘플 데이터를 처음 상태로 되돌립니다.')) registry.reset(); }}>교적 데이터 초기화</button>
								</div>
							{/if}
						</div>
						<button type="button" class="tool-btn" onclick={lock}>
							<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
							잠그기
						</button>
					</div>
				</nav>
			{/if}
		</div>
	</header>

	<main>
		{#if locked}
			<div class="card lock">
				<h2>교적 잠금</h2>
				<p>비밀번호를 5번 틀려 잠겼습니다. 사이트 관리자가 풀어 줘야 합니다.</p>
				<button class="ghost" onclick={adminUnlock}>(데모) 관리자가 잠금 해제</button>
			</div>
		{:else if !unlocked}
			<form class="card lock" onsubmit={submit}>
				<div class="lock-icon">
					<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
				</div>
				<h2>교적 비밀번호</h2>
				<p class="muted">교적 화면 전용 비밀번호입니다.<br />(프로토타입 데모 비밀번호: <b>0000</b>)</p>
				<input type="password" bind:value={pin} placeholder="비밀번호" />
				{#if fails}<p class="muted">틀렸습니다. ({fails}/5)</p>{/if}
				<p><button type="submit">들어가기</button></p>
			</form>
		{:else}
			{@render children()}
		{/if}
	</main>

	<footer class="site-footer">
		<div class="foot">
			<div>
				<b>부평동부교회 교적 관리 프로토타입</b>
				<p>가상 샘플 데이터로 동작하며 실제 DB에 연결되어 있지 않습니다.</p>
			</div>
			<p class="muted">입력한 내용은 이 브라우저에만 저장됩니다.</p>
		</div>
	</footer>
</div>
