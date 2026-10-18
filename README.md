# 교회 교적관리 (church-manage)

SvelteKit + Supabase(Pro) + Cloudflare Pages

## 로컬 실행
```sh
npm ci
cp .env.example .env   # Supabase 값 입력
npm run dev
```

## Supabase
1. `supabase/migrations/0001_init.sql` 을 SQL Editor에서 실행 (또는 Supabase CLI로 적용)
2. Project Settings > API 의 URL / anon key 를 환경변수로 사용

## 자동 배포 (main 브랜치에 push → Cloudflare Pages)
`.github/workflows/deploy.yml` 이 `main` push 때마다 빌드 후 배포합니다.

GitHub 저장소 Settings > Secrets and variables > Actions 에 등록:
| Secret | 설명 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare Pages 편집 권한 토큰 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 계정 ID |
| `PUBLIC_SUPABASE_URL` | Supabase URL |
| `PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |

Cloudflare에 Pages 프로젝트 `church-manage` 를 먼저 만들어 두세요 (Direct Upload 방식).
