<script lang="ts">
	// 확인 목록은 관리자 › 프로그램 설정 안으로 옮김 (예전 주소로 오면 그쪽으로 보냄)
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	onMount(() => goto(`/settings?tab=${encodeURIComponent('확인 목록')}`, { replaceState: true }));
</script>
