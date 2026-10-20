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

	onMount(() => {
		try {
			unlocked = sessionStorage.getItem('reg-unlocked') === '1';
			locked = localStorage.getItem('reg-locked') === '1';
		} catch {}
		const touch = () => (last = Date.now());
		window.addEventListener('click', touch);
		window.addEventListener('keydown', touch);
		const t = setInterval(() => {
			if (unlocked && Date.now() - last > IDLE_MS) lock();
		}, 30000);
		return () => {
			window.removeEventListener('click', touch);
			window.removeEventListener('keydown', touch);
			clearInterval(t);
		};
	});

	function lock() {
		unlocked = false;
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

	const nav = [
		{ href: '/', label: '교인 목록' },
		{ href: '/new', label: '새가족 등록' },
		{ href: '/households', label: '세대' },
		{ href: '/reports', label: '명단·통계' },
		{ href: '/candidates', label: '확인 목록' },
		{ href: '/import', label: '디모데 가져오기' },
		{ href: '/admin', label: '권한·기록' },
		{ href: '/ideas', label: '기능 아이디어' }
	];
	const active = (h: string) => (h === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(h));
</script>

{#if locked}
	<div class="card lock">
		<h2>교적 잠금</h2>
		<p>비밀번호를 5번 틀려 잠겼습니다. 사이트 관리자가 풀어 줘야 합니다.</p>
		<button class="ghost" onclick={adminUnlock}>(데모) 관리자가 잠금 해제</button>
	</div>
{:else if !unlocked}
	<form class="card lock" onsubmit={submit}>
		<h2>교적 비밀번호</h2>
		<p class="muted">교적 화면 전용 비밀번호입니다.<br />(프로토타입 데모 비밀번호: <b>0000</b>)</p>
		<input type="password" bind:value={pin} placeholder="비밀번호" />
		{#if fails}<p class="muted">틀렸습니다. ({fails}/5)</p>{/if}
		<p><button type="submit">들어가기</button></p>
	</form>
{:else}
	<div class="permbar">
		<b>내 교적 권한(시험용)</b>
		<span class="muted">기본: 열람</span>
		<label><input type="checkbox" checked={registry.perms.edit} onchange={(e) => registry.setPerms({ ...registry.perms, edit: e.currentTarget.checked })} />수정</label>
		<label><input type="checkbox" checked={registry.perms.export} onchange={(e) => registry.setPerms({ ...registry.perms, export: e.currentTarget.checked })} />내려받기</label>
		<label><input type="checkbox" checked={registry.perms.visit} onchange={(e) => registry.setPerms({ ...registry.perms, visit: e.currentTarget.checked })} />심방</label>
		<label><input type="checkbox" checked={registry.perms.admin} onchange={(e) => registry.setPerms({ ...registry.perms, admin: e.currentTarget.checked })} />사이트 관리자</label>
		<span style="flex:1"></span>
		<button class="ghost" onclick={() => { if (confirm('교적 샘플 데이터를 처음 상태로 되돌립니다.')) registry.reset(); }}>교적 데이터 초기화</button>
		<button class="ghost" onclick={lock}>잠그기</button>
	</div>
	<nav class="subnav">
		{#each nav as n}<a href={n.href} class:active={active(n.href)}>{n.label}</a>{/each}
	</nav>
	{@render children()}
{/if}
