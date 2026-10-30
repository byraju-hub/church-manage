# 교회 교적 관리 시스템 (프로토타입)

SvelteKit + Cloudflare Pages로 만든 **교회 교적 관리 시스템의 시험판**입니다.
교회가 직접 써 보며 **구조·기능·화면·입력 항목·권한**을 확정하고, 실제 개발자가 이것을 기준으로 정식 시스템을 만드는 것이 목적입니다.

- 사이트: https://church-manage.pages.dev (`main` 브랜치에 올리면 자동 배포)
- 데이터: **가상 데이터만** 씁니다 (재적 약 720명, 주일 출석 약 430명 규모). 입력한 내용은 각자 브라우저(localStorage)에만 저장됩니다.
- 실제 DB(Supabase)·카카오 로그인·출석부 연동은 아직 연결하지 않았습니다.

> 모든 이름·전화·주소는 만들어 낸 값입니다. **실제 교인 자료(엑셀·디모데 자료 등)와 진짜 교회 직인은 저장소에 올리지 않습니다.** (`.gitignore`가 `*.xlsx` `*.xls` `*.csv` `/private-data/` `/자료/` `/static/private/`를 막음)

**개발자 인계 문서는 [`docs/handover.md`](docs/handover.md)** 입니다. 정해진 것과 남은 질문은 [`docs/decisions.md`](docs/decisions.md), DB 구조 기준안은 [`supabase/migrations/0001_registry.sql`](supabase/migrations/0001_registry.sql)에 있습니다.

## 메뉴

| 메뉴 | 주소 | 내용 |
|---|---|---|
| 대시보드 | `/` | 통합 검색, 표어·현황 배너, 숫자 카드 8개, 캘린더(교회 절기·성례·사역·심방·성도·생일·공휴일), 출석 추이 |
| 교적 | `/members` `/members/columns` `/new` `/<id>` `/newcomers` `/households` | 교인 목록(검색·필터·엑셀·일괄 수정·문자), 교인 목록 항목 설정(한 줄/카드 보기), 교인 등록(등록카드 사진 읽기), 교적 카드, 새가족 정착, 세대 목록 |
| 공동체 | `/communities` `/communities/<소그룹>` `/communities/roster` | 공동체 편성표, 소그룹 페이지(출석률·가나다·나이 순 정렬), 소그룹별 명단(인쇄·엑셀·PDF) |
| 출석 | `/attendance` | 주일 오전예배 출석 등록 (교인구분 체크, 이름·직분·소그룹·공동체 검색) |
| 심방 (A 등급) | `/visits` | 캘린더 보기(심방·성도 일정), 심방 목록, 소그룹 특이사항, 심방 등록(녹음·문서 분석) |
| 조직 | `/orgs` | 교회 조직표, 당회(서기·위원장 순), 시무집사회, 시무권사회, 서리집사, 남·여전도회 — 인쇄·엑셀·PDF |
| 통계 | `/stats` `/reports` `/documents` | 주일 출석(전체·장년·교육부서 꺾은선), 소그룹 출석, 임직, 세례 / 명단 / 문서 출력(교적부·증명서·기부금 영수증·요람·조직표) |
| 관리자 › 교회 설정 | `/settings` | 기본 설정, 연간 설정(표어·나이 계산·연간 계획표 엑셀 등록·출생 연도·교육부서 기준), 교회 조직표, 소그룹 편성(공동체 추가·삭제) |
| 관리자 › 사용자 설정 | `/admin` | 사용자 목록, 가입 신청, 등급 설정, 접속 기록 |
| 관리자 › 프로그램 설정 | `/settings?tab=교인구분` | 교인구분, 코드표, 확인 목록, 백업 |

**소개 화면:** 로그아웃 상태에서 사이트 주소(`/`)를 열면 소개 화면이 나오고, **데모 사이트 구경하기**를 누르면 정담임 목사(최고관리자)로 바로 들어갑니다. 화면 사진은 `static/intro/`(가상 데이터), 화면은 `src/lib/components/Intro.svelte`입니다.

**로그인:** 카카오로 가입 → 최고관리자가 승인하고 등급(A 전임 교역자 · B 교적 관리 · C 열람)을 정함 → 사용.
시험판에서는 '카카오로 로그인'을 누르고 가상의 계정을 고릅니다 (최고관리자: 정담임). 위쪽 이름을 누르면 **다른 회원으로 보기**와 **교적 데이터 초기화**가 있습니다.

## 실행

내 컴퓨터에서 실행하거나 Cloudflare Pages에 올리는 순서는 **[설치 가이드 (PDF)](static/install-guide.pdf)** 에 있습니다. (원본: [`docs/install-guide.html`](docs/install-guide.html), 소개 화면에서도 내려받을 수 있습니다)

```sh
npm ci
npm run dev      # http://localhost:5173
npm run check    # 타입 검사
npm run build    # 배포용 빌드 → .svelte-kit/cloudflare
```

선택 기능(등록카드 사진 읽기, 심방 녹음·문서 분석, 문자 발송)은 API 키가 있어야 동작하고, 없으면 시연용 예시를 보여 줍니다. 키 이름은 `.env.example`을 보세요. 키는 로컬 `.env`나 Cloudflare 환경 변수에만 넣고 저장소에 올리지 않습니다.

## 폴더 구조

```
├─ docs/
│  ├─ handover.md                 개발자 인계 문서 (이관 순서·체크리스트)
│  └─ decisions.md                정해진 것 · 연동할 곳 · 남은 질문
├─ supabase/migrations/
│  └─ 0001_registry.sql           DB 구조 기준안 (표·권한 규칙 예시)
├─ static/                        로고 · 파비콘 · 견본 직인 · robots.txt (검색 엔진 차단)
└─ src/
   ├─ app.html · env.ts           HTML 틀(글꼴) · 서버 환경 변수 정의
   ├─ lib/
   │  ├─ registry/                ★ 데이터 계층 (정식 개발 때 Supabase로 바꿀 곳)
   │  │  ├─ store.svelte.ts       저장소 (지금은 localStorage) — 모든 읽기·쓰기
   │  │  ├─ types.ts              데이터 타입 (DB 표와 대응)
   │  │  ├─ derive.ts             이력 → 재적 상태·신급·직분·나이 계산
   │  │  ├─ config.ts             교인구분 3단계·공동체/소그룹·조직표 기본값
   │  │  ├─ site-settings.ts      기본 설정(교회 정보·증명서 양식·코드표·백업·모임 이름)
   │  │  ├─ year-settings.ts      연간 설정(나이 계산·출생 연도·교육부서 기준)
   │  │  ├─ calendar.ts           절기·공휴일(음력 표 2025~2030)·캘린더 색
   │  │  ├─ plan-import.ts        연간 계획 엑셀 읽기·분류
   │  │  ├─ care-events.ts        심방 내용의 날짜 일정(입원·수술 등) 뽑기
   │  │  ├─ age-mode.svelte.ts    나이 계산 방식 (화면 전체가 따름)
   │  │  └─ seed.ts · generate.ts · attendance.mock.ts   [시험판 전용] 가상 데이터
   │  ├─ components/              여러 화면에서 쓰는 부품 (캘린더, 검색, 입력 칸, 설정 패널, 인쇄·엑셀·PDF 버튼 …)
   │  └─ pdf-style.ts             PDF 만들 때 쓰는 스타일
   └─ routes/
      ├─ +layout.svelte · app.css 공통 틀·스타일
      ├─ api/                     서버 기능: card-scan(등록카드) · visit-analyze(심방 분석) · sms(문자)
      └─ (app)/                   모든 화면 (위 '메뉴' 표)
```

## 배포 (Cloudflare Pages)

저장소가 Cloudflare Pages에 연결되어 있어 `main`에 올리면 자동으로 빌드·배포됩니다.

- Build command `npm run build` · Output `.svelte-kit/cloudflare` · 환경 변수 `NODE_VERSION=22`

---

제작: [byraju](https://github.com/byraju-hub) · 문의: [byraju@naver.com](mailto:byraju@naver.com)
