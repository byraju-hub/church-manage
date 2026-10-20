<script lang="ts">
	import './app.css';

	let { children } = $props();
</script>

<svelte:head><title>부평동부교회 교적 관리</title><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" /><link rel="apple-touch-icon" href="/apple-touch-icon.png" /></svelte:head>

{@render children()}
