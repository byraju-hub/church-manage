<script lang="ts">
	// 심방 녹음·문서를 올리면 분석해서 심방 기록 칸을 채워 줍니다. (서버: /api/visit-analyze)
	export interface Analysis { kind: string | null; content: string | null; scripture: string | null; hymn: string | null; follow_up: string | null; companions: string[] }
	let { onresult }: { onresult: (r: Analysis) => void } = $props();

	let file = $state<File | null>(null);
	let busy = $state(false);
	let msg = $state('');
	let err = $state('');
	let transcript = $state<string | null>(null);
	let open = $state(false);

	async function run() {
		if (!file) return;
		busy = true; err = ''; msg = ''; transcript = null;
		try {
			const fd = new FormData();
			fd.append('file', file);
			const r = await fetch('/api/visit-analyze', { method: 'POST', body: fd });
			const j = await r.json();
			if (!r.ok) throw new Error(j.error ?? '분석에 실패했습니다.');
			onresult(j.result);
			transcript = j.transcript;
			msg = j.demo ? `${j.note}` : '분석 결과를 아래 칸에 채웠습니다. 내용을 확인하고 고쳐서 등록하세요.';
		} catch (e) {
			err = e instanceof Error ? e.message : '분석에 실패했습니다.';
		} finally {
			busy = false;
		}
	}
</script>

<div class="analyzer">
	<div class="row" style="justify-content:space-between;flex-wrap:wrap">
		<b>녹음·문서로 채우기 <span class="tag part">AI 분석</span></b>
		<span class="muted" style="font-size:.78rem">녹음(m4a·mp3·wav) · PDF · 텍스트 / 24MB 이하</span>
	</div>
	<div class="row" style="margin-top:.5rem;flex-wrap:nowrap">
		<input type="file" accept="audio/*,video/mp4,.m4a,.mp3,.wav,.pdf,.txt,.md,text/plain,application/pdf" onchange={(e) => { file = e.currentTarget.files?.[0] ?? null; msg = ''; err = ''; }} style="padding:.35rem" />
		<button type="button" onclick={run} disabled={!file || busy}>{busy ? '분석 중…' : '분석해서 채우기'}</button>
	</div>
	{#if msg}<p class="ok" style="margin:.6rem 0 0">{msg}</p>{/if}
	{#if err}<p class="warn" style="margin:.6rem 0 0">{err}</p>{/if}
	{#if transcript}
		<button type="button" class="ghost sm" style="margin-top:.5rem" onclick={() => (open = !open)}>{open ? '받아쓰기 원문 접기' : '받아쓰기 원문 보기'}</button>
		{#if open}<pre class="transcript">{transcript}</pre>{/if}
	{/if}
	<p class="muted" style="font-size:.76rem;margin:.6rem 0 0">※ 올린 파일의 내용은 분석을 위해 외부 AI 서비스로 전송됩니다. 심방 내용에는 건강 등 민감한 정보가 있을 수 있어, 실제 도입 전에 동의 절차와 보관 방침을 정해야 합니다. 파일 자체는 저장하지 않습니다.</p>
</div>

<style>
	.analyzer { padding: 0.9rem 1rem; border: 1px dashed var(--primary); border-radius: 12px; background: var(--primary-50); }
	.transcript { white-space: pre-wrap; max-height: 220px; overflow: auto; margin: 0.5rem 0 0; padding: 0.7rem; background: #fff; border: 1px solid var(--line); border-radius: 10px; font: inherit; font-size: 0.85rem; }
</style>
