<script lang="ts">
	import './app.css';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<header>
	<div class="bar">
		<a class="brand" href="/registry">
			<span class="logo">
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18M6 9h12" /></svg>
			</span>
			<span><b>교회 교적관리</b><small>프로토타입</small></span>
		</a>
	</div>
</header>
<main>{@render children()}</main>
<footer>교회 교적관리 프로토타입 · 가상 샘플 데이터로 동작하며 실제 DB에 연결되어 있지 않습니다.</footer>
