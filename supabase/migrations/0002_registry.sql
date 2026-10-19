-- 교적 스키마 (프로토타입 기준안) — '교적 데이터 안내서' 구조
-- src/lib/registry/types.ts 와 1:1 대응. 앱 프로필은 기존 public.custom_users 를 가정합니다.
-- 실제 DB에 이미 있는 테이블과 다른 점은 개발자가 조정해 주세요.
create schema if not exists registry;

-- 교적 카드 (사람당 1장). 이름·전화·성별·생년월일·이메일은 custom_users 에 있음
create table registry.people (
  id uuid primary key default gen_random_uuid(),
  custom_user_id uuid,                        -- 앱 가입자면 custom_users.id (has_account 는 계산)
  name_note text,                             -- 동명이인 구분 (예: 1975년생, 2소그룹)
  birth_lunar boolean not null default false, -- 음력 여부
  reg_no text unique,                         -- 교번 (재정 시작할 때 매김)
  address_zip text, address1 text, address2 text,  -- 비면 세대 주소 사용
  occupation text, workplace text,
  marital_status text check (marital_status in ('미혼','기혼','사별','기타')),
  wedding_date date,
  previous_church text,
  guide_person_id uuid references registry.people(id),  -- 인도자: 교인이면 연결
  guide_name text,                                       -- 교인 아니면 이름만
  sms_opt_out boolean not null default false,            -- 칸만 있음, 문자 발송 기능은 아직 없음
  faith_checked_on date,                                 -- 신급 확인일 (원입교인 판정)
  note text,
  purged_on date                                         -- 전출·별세·제적 5년 뒤 인적사항 지운 날
);

-- 세대(가족)
create table registry.households (
  id uuid primary key default gen_random_uuid(),
  no text unique not null, zip text, address text, home_phone text, note text
);
create table registry.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references registry.households(id) on delete cascade,
  person_id uuid unique references registry.people(id),  -- unique: 한 사람은 한 세대에만 속함
  name text, birth_year int,                             -- 교인이 아닌 가족은 이름·출생연도만
  relation text not null check (relation in ('본인','배우자','자녀','부모','며느리','사위','손자녀','형제자매','기타')),
  sort_order int not null default 0, note text,
  check (person_id is not null or name is not null)
);
-- 세대마다 '본인'(세대주)은 한 명
create unique index one_head_per_household on registry.household_members(household_id) where relation = '본인';

-- 이력 3종: 지금 값은 이력에서 계산 (재적 상태·신급·직분·등록일)
create table registry.status_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  kind text not null check (kind in ('등록','전입','복적','보류','전출','별세','제적')),
  event_date date, reason text, church text
);
create table registry.faith_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  kind text not null check (kind in ('학습','세례','유아세례','입교')),
  event_date date, church text, officiant text, note text
);
create table registry.office_terms (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  office text not null check (office in ('목사','전도사','장로','시무집사','권사','서리집사')),
  rank_status text not null check (rank_status in ('시무','은퇴','원로','명예','협동','사임')),
  start_date date, end_date date, note text
);

-- 메모·동의
create table registry.notes (            -- 담당자 메모: 교적 권한자 모두 열람
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  body text not null, author uuid, created_at timestamptz not null default now()
);
create table registry.legacy_memos (     -- 옛 디모데 메모: 심방 권한자만, 열 때마다 접속기록
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade, body text not null
);
create table registry.consents (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  kind text not null check (kind in ('교적 등록','민감정보','요람 공개','보호자 동의')),
  policy_version text not null, consent_date date,
  method text not null check (method in ('서면','앱','구두')),
  guardian_name text, revoked_on date
);

-- 권한·기록
create table registry.staff (            -- 교적 권한: 기본(열람) + 아래 항목
  user_id uuid primary key,
  can_edit boolean not null default false, can_export boolean not null default false,
  can_visit boolean not null default false, is_site_admin boolean not null default false,
  scope_community text                    -- 공동체별 맡김: 칸만 있고 쓰지 않음
);
create table registry.access_log (       -- 검색·열람·수정·내려받기·출력, 3년 보관
  id bigint generated always as identity primary key,
  at timestamptz not null default now(), user_id uuid, action text not null, target text, detail jsonb
);
create table registry.change_log (       -- 수정 전후 값
  id bigint generated always as identity primary key,
  person_id uuid references registry.people(id) on delete cascade,
  at timestamptz not null default now(), by_user uuid, field text, before text, after text
);

-- ---- 안내서 '새 자료 필요' 기능을 위한 제안 (실제 도입 여부는 논의 필요) ----
create table registry.visits (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  visit_date date not null, visitor text not null, content text, follow_up text
  -- 누가 볼지(쓴 교역자만 / 교역자 전체 / 담임목사까지) 칸은 아직 미정
);
create table registry.affiliations (    -- 선교회·부서·찬양대·봉사
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  org text not null, role text, start_date date, end_date date
);
create table registry.small_group_history (  -- 소그룹 이동 이력 (지금은 현재 소속만 있음)
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  small_group text not null, start_date date, end_date date
);

-- 공동체·소그룹은 교적에 두지 않고 출석부의 공동체 → 소그룹 → 구성원 명단을 그대로 씁니다.
-- RLS: 교적 권한자만 접근하도록 registry.staff 기준 정책을 개발 시 추가해야 합니다.
