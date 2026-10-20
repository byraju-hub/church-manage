-- 교적 스키마 (프로토타입 기준안) — '교적 데이터 안내서' 구조
-- src/lib/registry/types.ts 와 1:1 대응. 앱 프로필은 기존 public.custom_users 를 가정합니다.
-- 실제 DB에 이미 있는 테이블과 다른 점은 개발자가 조정해 주세요.
create schema if not exists registry;

-- 교적 카드 (사람당 1장). 이름·전화·성별·생년월일·이메일은 custom_users 에 있음
-- 교인구분: 최대 3단계 (교인/미등록·타교인 > 장년/청년/교육부서/새가족 > 예배출석/가끔출석/불출석, 별세·이사/이민·보관은 1단계)
create table registry.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references registry.categories(id),
  name text not null, sort_order int not null default 0
);

create table registry.people (
  id uuid primary key default gen_random_uuid(),
  custom_user_id uuid,                        -- 앱 가입자면 custom_users.id (has_account 는 계산)
  name_note text,                             -- 동명이인 구분 (예: 1975년생, 2소그룹)
  birth_lunar boolean not null default false, -- 음력 여부
  reg_no text unique,                         -- 교번 (재정 시작할 때 매김)
  address_zip text, address1 text, address2 text,  -- 비면 세대 주소 사용
  occupation text, workplace text,
  marital_status text check (marital_status in ('미혼','기혼','이혼','사별','기타')),
  wedding_date date,
  previous_church text,
  guide_person_id uuid references registry.people(id),  -- 인도자: 교인이면 연결
  guide_name text,                                       -- 교인 아니면 이름만
  sms_opt_out boolean not null default false,            -- 칸만 있음, 문자 발송 기능은 아직 없음
  faith_checked_on date,                                 -- 신급 확인일 (원입교인 판정)
  note text,
  purged_on date,                                        -- 전출·별세·제적 5년 뒤 인적사항 지운 날 (보관은 지우지 않음)
  photo text,                                            -- 사진 (저장소 경로)
  category_id uuid references registry.categories(id),   -- 교인구분 (3단계 카테고리의 한 칸)
  clergy_title text check (clergy_title in ('담임목사','부목사','교육목사','전임전도사','교육전도사')),
  edu_dept text check (edu_dept in ('영아부','유치부','유초등부','중고등부','청년부')),
  mission_society text,                                  -- 전도회: 1~6남전도회, 1~10여전도회
  big_family_head_id uuid references registry.people(id),-- 대가족 세대주 (세대와 별개)
  big_family_relation text
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
  kind text not null check (kind in ('등록','전입','복적','보류','보관','전출','별세','제적')),
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
  office text not null check (office in ('목사','전도사','사모','장로','시무집사','권사','서리집사')),
  rank_status text not null check (rank_status in ('시무','은퇴','원로','명예','협동','사임','전입','서리')),
  start_date date, end_date date,          -- start_date = 임직일
  church text,                             -- 임직교회 (비면 본 교회)
  note text                                -- 휴직·무임 등
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

-- ---- 심방 ('교적 프로그램 구조' 문서) : 전임 교역자까지만 열람 ----
create table registry.visits (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  visit_date date not null,
  state text not null check (state in ('계획','완료')),
  kind text not null,                         -- 심방 구분 (디모데 목록 기준)
  method text not null check (method in ('방문','전화')),
  pastor text not null, companions text, scripture text, hymn text,
  content text, follow_up text
);

-- 교회 조직표 (위원회 > 실무부서), 교회봉사 소속 (여러 곳 가능)
create table registry.org_units (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references registry.org_units(id), name text not null, sort_order int not null default 0,
  leader_id uuid references registry.people(id)   -- 위원장(장로) / 실무부서 담당자
);
create table registry.affiliations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  org_unit_id uuid references registry.org_units(id), role text, start_date date, end_date date
);

-- 교육 (지금은 새가족 교육만)
create table registry.education_courses (id uuid primary key default gen_random_uuid(), name text not null);
create table registry.education_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  course_id uuid not null references registry.education_courses(id),
  start_date date, end_date date, completed boolean not null default false, instructor text, note text
);

-- 일정 (캘린더): 교회 기념일·사역·성례·성도 기념일(수술·입원 등). 생일·결혼기념일·심방 계획은 다른 표에서 계산
create table registry.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('성도 기념일','교회 기념일','사역 일정','성례 일정')),
  event_date date not null, end_date date, title text not null,
  person_id uuid references registry.people(id), note text
);

-- 공동체·소그룹은 출석부 자료를 그대로 씁니다(편성표: 공동체 3개, 소그룹 27개 + 로뎀나무숲).
-- 교적에서는 편성표(인도자·장소)와 소속을 가져와 보여 주기만 하고, 출석 기록과 인도자 특이사항은 출석부에 있습니다.
-- RLS: 교적 권한자만 접근하도록 registry.staff 기준 정책을 개발 시 추가해야 합니다.
