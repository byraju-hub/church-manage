# 교회 교적관리 (church-manage) — 프로토타입

SvelteKit + Cloudflare Pages. **실제 DB(Supabase)에는 연결하지 않는 프로토타입**입니다.
교적 프로그램에 필요한 기능·화면·데이터 항목을 점검하기 위한 용도이며,
실제 개발은 이 프로토타입을 기준으로 진행합니다.

## 구조
| 위치 | 설명 |
|---|---|
| `supabase/migrations/0002_registry.sql` | **교적 데이터 안내서 기준 스키마** (registry.people, households, status/faith/office 이력, 메모·동의, 권한·기록) |
| `src/lib/registry/types.ts` | 스키마와 1:1 대응하는 타입 |
| `src/lib/registry/derive.ts` | 이력에서 재적 상태·신급·직분·호칭·등록일을 계산 |
| `src/lib/registry/seed.ts` | 가상 샘플 데이터 (홍길동 등 시험용 인물 + 아래 생성기 결과) |
| `src/lib/registry/generate.ts` | 실제 교회 규모(재적 약 1,000명)의 가상 교인 생성기. 공동체 3개·소그룹 27개 + 로뎀나무숲 구조만 2026년 편성표를 따르고, 이름·전화·주소는 모두 만들어 낸 값 |
| `src/lib/registry/store.svelte.ts` | 데이터 계층. 브라우저 localStorage에 저장. **실제 개발 시 이 파일의 메서드를 Supabase 호출로 교체** |
| `src/lib/registry/config.ts` | 교인구분 3단계, 공동체·소그룹 편성 구조, 교회 조직표 (설정 성격의 자료) |
| `src/lib/registry/calendar.ts` | 부활주일 등 해마다 날짜가 바뀌는 교회 절기 계산 |
| `src/lib/components/` | 캘린더, 통합 검색창, 교인 선택, 교인 카드 입력 칸 |
| `src/routes/(app)/` | 화면 (폴더 이름의 `(app)` 은 주소에 나타나지 않음) — `/` 대시보드(검색·캘린더·현황), `/members` 교인 목록(기본·복수·항목별 검색), `/<id>` 교적 카드, `/new` 교인 등록, `/households` 세대, `/communities` 공동체 편성표, `/attendance` 주일 출석 등록, `/visits` 심방, `/orgs` 조직, `/stats` 통계, `/reports` 명단, `/candidates` 확인 목록, `/admin` 권한·기록, `/settings` 설정, `/ideas` 기능 아이디어 |
| `src/routes/app.css` | 전체 디자인(밝은 단일 테마) |

첫 화면(`/`)은 대시보드입니다. 화면 구성은 `docs/decisions.md` 와 '교적 프로그램 구조' 문서를 따릅니다. 교적 전용 비밀번호(데모: `0000`)로 들어가고, 화면 위쪽 '내 교적 권한'으로 열람·수정·내려받기·심방·사이트 관리자 권한을 켜고 꺼 가며 시험할 수 있습니다.

입력한 데이터는 각자 브라우저에만 저장되며, '교적 데이터 초기화' 버튼으로 샘플 상태로 되돌릴 수 있습니다.

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
