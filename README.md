# 교회 교적관리 (church-manage) — 프로토타입

SvelteKit + Cloudflare Pages. **실제 DB(Supabase)에는 연결하지 않는 프로토타입**입니다.
교적 프로그램에 필요한 기능·화면·데이터 항목을 점검하기 위한 용도이며,
실제 개발은 이 프로토타입을 기준으로 진행합니다.

## 구조
| 위치 | 설명 |
|---|---|
| `supabase/migrations/0001_init.sql` | **DB 스키마 기준안** (groups, families, members, attendance, visits) |
| `src/lib/types.ts` | 스키마와 1:1 대응하는 타입 |
| `src/lib/mock/seed.ts` | 스키마 기반 샘플 데이터 |
| `src/lib/store.svelte.ts` | 데이터 계층. 브라우저 localStorage에 저장. **실제 개발 시 이 파일의 메서드를 Supabase 호출로 교체** |
| `src/routes/` | 화면 (대시보드, 교인 목록/검색/등록/수정/상세, 심방 기록) |

입력한 데이터는 각자 브라우저에만 저장되며, 화면 우상단 "샘플 데이터 초기화"로 되돌릴 수 있습니다.

## 로컬 실행
```sh
npm ci
npm run dev
```

## 배포 (Cloudflare Pages)
Cloudflare Pages에 이 GitHub 저장소를 직접 연결해 둡니다. `main` 브랜치가 바뀔 때마다 자동으로 빌드·배포됩니다.

- Production branch: `main`
- Build command: `npm run build`
- Build output directory: `.svelte-kit/cloudflare`
- Environment variable: `NODE_VERSION` = `22`
