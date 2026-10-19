<script lang="ts">
	import { page } from '$app/state';
	import { store } from '#lib/store.svelte.ts';
	import './app.css';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();

	const nav = [
		{ href: '/', label: '대시보드' },
		{ href: '/members', label: '교인 관리' },
		{ href: '/registry', label: '교적 (안내서 기준)' }
	];
	const active = (href: string) =>
		href === '/' ? page.url.pathname === '/' : page.url.pathname.startsWith(href);

	function reset() {
		if (confirm('샘플 데이터로 초기화합니다. 입력한 내용이 모두 사라집니다.')) store.reset();
	}
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header>
	<strong>교회 교적관리 <small>프로토타입</small></strong>
	<nav>
		{#each nav as n}
			<a href={n.href} class:active={active(n.href)}>{n.label}</a>
		{/each}
	</nav>
	<button class="ghost" onclick={reset}>샘플 데이터 초기화</button>
</header>
<main>{@render children()}</main>
