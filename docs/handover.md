# 교적 관리 시스템 — 실제 서비스 이관 매뉴얼

**대상:** 이 프로토타입을 받아 실제 교적 관리 시스템을 만들 개발자
**작성:** 2026년 10월 · 부평동부교회
**함께 볼 문서:** [`docs/decisions.md`](decisions.md)(정한 것·남은 질문), [`supabase/migrations/0001_registry.sql`](../supabase/migrations/0001_registry.sql)(DB 구조 기준안), [`README.md`](../README.md)

---

## 1. 지금 상태 한눈에

| 항목 | 프로토타입 (지금) | 실제 서비스 (만들 것) |
|---|---|---|
| 목적 | 화면·기능·입력 항목·권한을 교회가 직접 써 보며 확정 | 실제 교인 자료로 운영 |
| 데이터 | **가상 데이터**(재적 723명 규모), 브라우저 `localStorage`에 저장 | Supabase(PostgreSQL) DB |
| 로그인 | 카카오 로그인 **흉내**(가상 계정 고르기) | Supabase Auth 의 Kakao 공급자 (홈페이지와 같은 카카오 계정) |
| 권한 | 화면에서만 막음 | **DB(RLS)와 서버에서 막음** — 화면은 보조 |
| 출석 자료 | 가상 샘플 (`attendance.mock.ts`) | 홈페이지 출석부(소그룹)·중고등부 출석 사이트와 연동 |
| 배포 | Cloudflare Pages (`main` 푸시 → 자동 배포) | 같은 방식 권장 + 교회 도메인 연결 |

> 프로토타입의 모든 이름·전화·주소는 만들어 낸 값입니다. **실제 교인 자료(엑셀·디모데 자료 등)는 저장소에 절대 올리지 않습니다.** `.gitignore` 가 `*.xlsx` `*.xls` `*.csv` `/private-data/` 를 막고 있습니다.

---

## 2. 기술 스택과 실행

- **SvelteKit 3 + Svelte 5(runes) + TypeScript + Vite**, 배포 어댑터 `@sveltejs/adapter-cloudflare`
- 화면은 브라우저에서 그림(`ssr = false`, `src/routes/+layout.ts`). 실제 서비스에서 SSR을 켤지는 개발자 판단.
- import 경로는 `#lib/...` 에 `.ts` 확장자를 붙여 씀.
- 서버 환경 변수는 `src/env.ts` 의 `defineEnvVars` 로 정의하고 `$app/env/private` 에서 읽음.
- 주요 라이브러리: `html2pdf.js`·`jspdf`(PDF), `write-excel-file`(엑셀 .xlsx), 다음 우편번호 서비스(주소 검색, 스크립트로 불러옴).

```sh
npm ci
npm run dev      # http://localhost:5173
npm run check    # 타입 검사 (svelte-check)
npm run build    # 배포용 빌드 → .svelte-kit/cloudflare
```

**Cloudflare Pages 설정:** Production branch `main` · Build command `npm run build` · Output `.svelte-kit/cloudflare` · 환경 변수 `NODE_VERSION=22`

---

## 3. 홈페이지에 넣는 방법 (권장 구성)

```
 교인·교역자 ──▶ 교회 홈페이지 (dbchurch.net)
                    │  메뉴 '교적 관리' 링크
                    ▼
               교적 관리 (예: registry.dbchurch.net)  ── Cloudflare Pages
                    │  로그인: 카카오 (홈페이지와 같은 카카오 앱)
                    ▼
               Supabase (Auth · DB · Storage)
                    ▲                       ▲
   홈페이지 출석부(소그룹)          중고등부 출석 사이트(카페24 PHP)
   → 읽기 전용 API로 가져옴         → 읽기 전용 API로 가져옴
```

1. **별도 하위 도메인으로 띄웁니다.** (예: `registry.dbchurch.net`) 홈페이지 안에 iframe 으로 넣는 방식은 로그인·인쇄·휴대폰 화면 문제가 생기므로 권하지 않습니다. 홈페이지에는 '교적 관리' 메뉴(링크)만 둡니다.
   - Cloudflare Pages › Custom domains 에 하위 도메인을 추가하고, 교회 도메인 DNS 에 CNAME 을 연결합니다.
2. **로그인은 홈페이지와 같은 카카오 앱을 씁니다.** 카카오 개발자 콘솔에서 Redirect URI(`https://<supabase 프로젝트>.supabase.co/auth/v1/callback`)를 추가하고, Supabase Auth › Providers › Kakao 에 REST API 키·Client Secret 을 넣습니다. 동의 항목(닉네임·이메일)을 설정합니다.
   - 처음 로그인하면 `registry.app_users` 에 **'승인 대기'** 회원이 생기고(트리거), **최고관리자가 회원 목록에서 승인·등급 지정**해야 쓸 수 있습니다. (프로토타입 로그인 화면 문구 그대로)
3. **검색 엔진 차단:** `static/robots.txt` 로 막아 두었습니다. 실제 서비스도 그대로 유지하고, 모든 화면은 로그인 뒤에만 보이게 합니다.

---

## 4. 코드 구조와 '바꿔 끼울 곳'

```
src/
├─ env.ts                         서버 환경 변수 정의
├─ lib/registry/                  ★ 데이터 계층 — 여기만 Supabase 로 바꾸면 화면은 대부분 그대로 씀
│  ├─ types.ts                    데이터 타입 (DB 표와 1:1 대응)
│  ├─ config.ts                   교인구분 3단계 기본값 · 공동체/소그룹 편성 기본값 · 조직표 · fixCat
│  ├─ derive.ts                   이력 → 재적 상태·신급·직분·호칭 계산 (순수 함수, 그대로 재사용 가능)
│  ├─ calendar.ts                 교회 절기 계산·캘린더 색
│  ├─ store.svelte.ts             ★ 저장소 (지금은 localStorage) — 실제로는 Supabase 호출로 교체
│  ├─ seed.ts · generate.ts       [프로토타입 전용] 가상 인물·회원·교인 생성
│  └─ attendance.mock.ts          [프로토타입 전용] 가상 출석 샘플
├─ lib/components/                화면 부품 (Calendar, GlobalSearch, PersonFields, PersonPicker,
│                                  ExportButtons, SmsDialog, CardScan, VisitAnalyzer, PhotoCropper …)
└─ routes/
   ├─ api/card-scan/              등록카드 사진 → 교인 등록 칸 채우기 (Claude API)
   ├─ api/visit-analyze/          심방 녹음·문서 → 심방 기록 칸 채우기 (OpenAI 받아쓰기 + Claude 요약)
   ├─ api/sms/                    문자 발송 (솔라피)
   └─ (app)/                      모든 화면 (아래 5장)
```

### 4-1. `store.svelte.ts` 를 Supabase 로 바꾸는 요령
- `Registry` 클래스 하나가 **읽기(`person`, `summary`, `groupsIn`, `worshipRoster` …)** 와 **쓰기(`updatePerson`, `addStatus`, `addFaith`, `addOffice`, `setGroup`, `bulkEdit`, `addVisit`, `saveSmsTemplate` …)** 를 모두 가집니다. 메서드 이름·인자를 그대로 두고 안쪽만 Supabase 호출로 바꾸면 화면 수정이 최소가 됩니다.
- 쓰기 메서드는 모두 **변경 이력(`change_log`)과 접속기록(`access_log`)** 을 남깁니다. 실제 서비스에서는 이 기록을 **DB 트리거나 서버 함수**에서 남겨, 화면을 거치지 않은 수정도 기록되게 합니다.
- `migrate()` / `load()` 의 localStorage 정리 코드(예전 키 삭제, 예전 등급 1·2·3 → A·B·C 변환, 미등록/타교인·불출석 정리)는 **프로토타입 전용**입니다. 실제 서비스에는 필요 없습니다.
- 가상 데이터를 쓰는 곳(`seed.ts`, `generate.ts`, `attendance.mock.ts`의 `wasPresent`·`wasPresentGroup`·`sampleOthers`)은 실제 DB 조회로 바꿉니다.

### 4-2. 이력에서 계산하는 값 (중요 설계)
재적 상태·신급·직분은 **지금 값을 직접 저장하지 않고 이력에서 계산**합니다(`derive.ts`).
- 재적: `status_events`(등록·전입·복적·보류·보관·전출·별세·제적)
- 신급: `faith_events`(학습·세례·유아세례·입교)
- 직분: `office_terms`(직분 + 구분 + 임직일·끝난 날)
- 재적 이력을 남기면 교인구분 1단계가 자동으로 맞춰집니다(`syncCategory`). 실제 서비스에서는 **DB 트리거**로 같은 규칙을 둡니다.

---

## 5. 화면별 기능과 권한

### 5-1. 권한 체계

| 구분 | 할 수 있는 일 |
|---|---|
| **A · 전임 교역자** | 수정·내려받기·출력 + **심방 전체(고정, 바꿀 수 없음)** + **문자 보내기** |
| **B · 교적 관리** | 수정·내려받기·출력 |
| **C · 열람** | 교적 열람만 |
| **최고관리자** (회원별 표시) | 가입 승인·등급 지정·등급 설정·사용 정지 + **일괄 수정** + 관리자 메뉴(확인 목록·설정). 심방은 A 등급일 때만 |
| 사이트 관리자 권한 | 관리자 › 설정 (교인구분·소그룹·조직표) |

- 등급별 수정·내려받기 권한은 최고관리자가 '등급 설정'에서 바꿀 수 있습니다. **심방만은 A 등급 고정**입니다.
- 달력의 '심방 계획'(이름·날짜)은 모든 회원에게 보이고, 심방 내용은 A 등급만 봅니다.
- **모든 권한은 화면과 별도로 DB(RLS)·서버에서 다시 확인**해야 합니다. SQL 맨 아래 `is_member_user()`, `can_visit()`(A 등급), `is_super()` 예시 참고.

### 5-2. 메뉴와 화면

| 메뉴 | 주소 | 주요 기능 |
|---|---|---|
| 대시보드 | `/` | 통합 검색, 현황 카드(주일 출석·소그룹 출석·교육부서·새가족·심방(A)·장기결석 알림), 캘린더(6색), 출석 추이, 바로 가기 |
| 교적 › 교인 목록 | `/members` | 기본·복수·항목별 검색과 필터, 목록·상세 2단, 상태(예배출석·가끔출석·불출석·장결자)·직분(구분 포함) 표시, **엑셀 내려받기**, **일괄 수정(최고관리자)**, **문자 보내기(A)** |
| 교적 › 교인 등록 | `/new` | 등록카드 사진 촬영 → AI 가 칸 채우기, 동명이인 A·B·C 자동, 주소 검색, 차량 번호, 동의 기록 |
| 교적 카드 | `/<id>` | 기본 정보·세대·신급/직분·재적 이력·소속·교육·심방(A)·메모/동의·변경 이력 |
| 교적 › 새가족 정착 / 세대 목록 | `/newcomers` `/households` | 등록→교육→수료→소그룹 배정 / 세대·대가족 |
| 공동체 › 편성표 · 소그룹 | `/communities` `/communities/<소그룹>` | 공동체별 소그룹·인도자·장소·인원·출석, 소그룹 상세(인도자 맨 위, 인도자 특이사항은 A) |
| 공동체 › 소그룹별 명단 | `/communities/roster` | 공동체·소그룹 선택, 올해 출석률 색, **인쇄·엑셀·PDF(항목 선택)** |
| 출석 | `/attendance` | 주일 오전예배 출석 등록(장년·새가족, 교인구분 3단계 체크), 전체 출석 인원 입력 |
| 심방 (A) | `/visits` | 심방 목록·캘린더 보기·소그룹 특이사항·심방 등록(녹음·문서 분석) |
| 조직 | `/orgs` | 당회·시무집사회·시무권사회·남/여전도회·교회 조직표 |
| 통계 › 통계 / 명단 / 문서 출력 | `/stats` `/reports` `/documents` | 출석·임직·세례 통계 / 명단 / 교적부·교인증명서·세례증명서(교회 로고)·교인 요람·생일 명단·직분자 명단·교회 조직표(한 장) — 인쇄·PDF |
| 관리자 › 회원·권한 / 확인 목록 / 설정 | `/admin` `/candidates` `/settings` | 가입 승인·등급·접속기록 / 중복·미등록 확인 / 교인구분(순서 변경)·소그룹 편성(추가·수정·삭제)·조직표 |

---

## 6. 데이터베이스

기준안: `supabase/migrations/0001_registry.sql` (스키마 `registry`). 화면의 `types.ts` 와 1:1 대응합니다.

| 묶음 | 표 |
|---|---|
| 회원·권한 | `grades`, `app_users` (+ auth 트리거 `on_auth_user_created`) |
| 교인 | `categories`(3단계), `people`(차량 번호 `car_number` 포함), `households`, `household_members` |
| 이력 | `status_events`, `faith_events`, `office_terms`, `change_log`, `access_log`(3년 보관) |
| 공동체·출석 | `small_groups`, `person_groups`, `group_notes`(A만), `worship_attendance`, `worship_totals`, `group_attendance` |
| 기타 교적 | `notes`, `legacy_memos`(디모데 메모, A만·열 때마다 기록), `consents`, `affiliations`, `education_courses`, `education_records` |
| 심방·일정·조직 | `visits`(A만), `events`, `org_units`, `org_unit_staff`, `meeting_officers` |
| 문서·문자 | `certificates`(증명서 발급 대장), `sms_templates`, `sms_log` |

**꼭 지킬 것**
- 모든 표에 **RLS** 를 켭니다. 심방·디모데 메모·인도자 특이사항은 `can_visit()`(A 등급)만.
- 고정 카테고리 id(`dead`·`move`·`keep`·`o`·`m.a.a` 등)는 지우지 못하게 합니다.
- 사진은 Storage **비공개 버킷**, `people.photo` 에는 경로만.
- 음력 생일은 조회할 때 그해 양력으로 변환(프로토타입은 같은 월·일로 표시).
- 주민등록번호는 두지 않습니다.

---

## 7. 외부 연동

| 연동 | 쓰는 곳 | 상태 | 할 일 |
|---|---|---|---|
| 카카오 로그인 | 로그인 | 흉내 | Supabase Auth Kakao 설정 (3장) |
| 홈페이지 출석부 (소그룹 모임 출석·인도자 특이사항) | 대시보드·편성표·명단 출석률·통계 | 가상 샘플 | 출석부 쪽에 **읽기 전용 API** 를 두고 가져오기 (한쪽 방향) |
| 중고등부 출석 사이트 (카페24 PHP, `byraju.mycafe24.com/67`) | 교육부서 출석 | **보류** | 토큰으로 보호한 `api/export.php`(JSON) 추가 → 교적 서버가 가져옴. 학생 ↔ 교인은 이름+생년월일+연락처로 한 번 짝지어 저장 |
| 등록카드 읽기 (Claude API) | 교인 등록 | 키 있으면 동작, 없으면 시연 | 사진이 외부 AI 로 전송됨 → 개인정보 처리방침에 명시 |
| 심방 녹음·문서 분석 (OpenAI 받아쓰기 + Claude 요약) | 심방 등록 | 키 있으면 동작, 없으면 시연 | 민감정보 → 동의·보관 방침 |
| 문자 발송 (솔라피) | 교인 목록 › 문자 보내기 (A) | 키 있으면 동작, 없으면 시연. 가상 번호(010-0000-…)는 절대 발송 안 함 | 발신번호 등록, 서버에서 A 등급·수신 거부 재확인, `sms_log` 기록 |
| 주소 검색 | 교인 등록·수정 | 다음 우편번호 서비스 | 그대로 사용 가능 |
| 스데반정보 덤프 (심방·헌금) | — | 미정 | `decisions.md` '연동이 필요한 곳' 참고 |

### 환경 변수 (Cloudflare Pages › Settings › Variables and Secrets)

| 이름 | 용도 |
|---|---|
| `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`(선택) | 등록카드 읽기·심방 요약 |
| `OPENAI_API_KEY` | 심방 녹음 받아쓰기 |
| `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER` | 문자 발송 (발신번호는 솔라피에 등록한 번호) |
| `SOLAPI_TEST_TO`(선택) | 시험용: 모든 문자를 이 번호 한 곳으로만 |
| (실제 서비스) Supabase URL·anon key·service role key | 서버 전용 키는 절대 화면 코드에 넣지 않음 |

키는 **Cloudflare 환경 변수(Secret)** 에만 넣고 저장소·채팅에 올리지 않습니다.

---

## 8. 보안·개인정보 체크리스트

- [ ] 모든 표 RLS, 서버 API(`/api/*`)에서 **로그인·등급 재확인** (지금은 같은 사이트 요청인지와 IP별 횟수만 확인)
- [ ] 문자 발송: 화면이 보낸 번호를 믿지 말고 **교인 ID → DB 에서 번호 재조회**, 수신 거부 재확인, 하루 한도, 광고성 문자 규정
- [ ] 일괄 수정: 서버에서 최고관리자 확인, 사람별 변경 이력 + 접속기록 한 줄
- [ ] 접속기록 3년 보관(로그인·검색·열람·수정·내려받기·출력·심방·권한 변경·문자 발송)
- [ ] 5년 뒤 인적사항 삭제(보관 교적 제외) 작업
- [ ] 일괄 동의(교적 등록·민감정보·요람 공개·보호자 동의)를 새 시스템 시작 때 받고 `consents` 에 기록
- [ ] 외부 서비스로 가는 자료(등록카드 사진, 심방 녹음·문서, 문자 번호) → 개인정보 처리방침·동의서에 명시
- [ ] 미성년자(교육부서) 자료는 최소 항목만, 보호자 동의
- [ ] 30분 미사용 시 자동 로그아웃(프로토타입에 있음) 유지
- [ ] 인쇄·PDF·엑셀에 '개인정보 문서' 안내 문구 유지, 내려받기는 권한자만

---

## 9. 기존 자료 옮기기 (디모데 등)

1. 실제 자료 파일은 **저장소 밖**(교회 PC, 암호 걸린 폴더)에서만 다룹니다.
2. 옮길 순서: `categories` → `people` → `households`/`household_members` → `status_events` → `faith_events` → `office_terms` → `person_groups` → `notes`/`legacy_memos`(디모데 메모) → `visits`.
3. 사람 맞추기: 동명이인은 등록 순서대로 A·B·C. 앱 가입자와 교적이 겹치는 경우는 **확인 목록**(관리자 메뉴)에서 합치기·새로 만들기를 고릅니다.
4. 문자 수신 거부, 차량 번호, 교인구분 3단계 값이 원본에 있으면 함께 옮깁니다.
5. 옮긴 뒤 표본 확인: 재적 인원·직분자 수·세대 수를 기존 프로그램과 비교합니다.

---

## 10. 이관 단계 (권장 순서)

| 단계 | 할 일 | 끝났다고 보는 기준 |
|---|---|---|
| 0. 준비 | 저장소·Cloudflare·Supabase 접근 권한 받기, `decisions.md` 남은 질문 정리 | 교회와 남은 질문 합의 |
| 1. DB | `0001_registry.sql` 검토·조정 후 적용, RLS 전부 켜기 | 등급별 계정으로 접근 시험 통과 |
| 2. 로그인 | Supabase Auth Kakao, 승인 대기 → 승인 흐름 | 실제 카카오 계정으로 가입·승인·등급 동작 |
| 3. 데이터 계층 | `store.svelte.ts` 를 Supabase 호출로 교체, 기록은 트리거/서버 함수로 | 모든 화면이 DB 값으로 동작 |
| 4. 서버 API | `/api/card-scan`·`/api/visit-analyze`·`/api/sms` 에 로그인·등급 확인 추가 | 권한 없는 계정 요청 거부 |
| 5. 연동 | 홈페이지 출석부, (보류 중) 중고등부 출석 사이트 | 출석 화면·통계가 실제 출석으로 표시 |
| 6. 자료 이관 | 9장 순서대로, 표본 확인 | 인원·직분·세대 수 일치 |
| 7. 공개 | 하위 도메인 연결, 홈페이지 메뉴 링크, 사용자 안내 | 시범 운영(교역자·교적 담당) 후 전체 공개 |

---

## 11. 프로토타입 전용이라 정리할 것

- 가상 데이터: `seed.ts`, `generate.ts`, `attendance.mock.ts`, 로그인 화면의 '카카오 계정 고르기' 흉내
- 상단 회원 메뉴의 **다른 회원으로 보기**, **교적 데이터 초기화**
- 하단 바닥글의 "프로토타입 · 가상 샘플 데이터" 문구
- `store.svelte.ts` 의 localStorage 저장·`migrate()` 정리 코드, `KEY = 'church-registry-proto-v16'`
- 각 API 의 '시연(demo)' 응답, 문자 발송의 가상 번호(010-0000-…) 차단 코드는 실제 자료에서는 필요 없음
- 확인 목록(`/candidates`)의 가상 예시 3건

## 12. 알려진 문제·남은 일

- **교적 카드 수정 시 본인 주소 필수:** 가상 교인은 주소가 세대에만 있어 수정 저장이 막힘. 세대 주소가 있으면 본인 주소를 비워도 되게 할지 결정 필요.
- **중고등부 출석 사이트 연동:** 보류 (7장).
- 그 밖의 결정 대기 사항은 [`docs/decisions.md`](decisions.md) '아직 정하지 못한 것'을 봅니다.
