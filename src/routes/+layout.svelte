<script lang="ts">
	import './app.css';

	import { onMount } from 'svelte';

	let { children } = $props();

	// 휴대폰에서 손가락으로 벌려 확대(핀치 줌)하지 못하게 막음. iOS Safari 는 viewport 설정을 무시해서 따로 막아야 함
	onMount(() => {
		const stop = (e: Event) => e.preventDefault();
		const pinch = (e: TouchEvent) => { if (e.touches.length > 1) e.preventDefault(); };
		document.addEventListener('gesturestart', stop, { passive: false });
		document.addEventListener('gesturechange', stop, { passive: false });
		document.addEventListener('touchmove', pinch, { passive: false });
		return () => {
			document.removeEventListener('gesturestart', stop);
			document.removeEventListener('gesturechange', stop);
			document.removeEventListener('touchmove', pinch);
		};
	});
</script>

<svelte:head><title>부평동부교회 교적 관리</title><link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" /><link rel="apple-touch-icon" href="/apple-touch-icon.png" /></svelte:head>

{@render children()}
