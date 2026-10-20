<script lang="ts">
	import './app.css';
	import favicon from '#lib/assets/favicon.svg';

	let { children } = $props();
</script>

<svelte:head><title>부평동부교회 교적 관리</title><link rel="icon" href={favicon} /></svelte:head>

{@render children()}
