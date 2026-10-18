<script lang="ts">
	let { data } = $props();
</script>

<h1>교회 교적관리</h1>
<p>{data.user ? `${data.user.email} 님 환영합니다` : '로그인이 필요합니다'}</p>
