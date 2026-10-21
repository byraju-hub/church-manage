-- 부평동부교회 교적 스키마 (프로토타입 기준안)
-- 프로토타입 화면(src/routes)과 src/lib/registry/types.ts 에 맞춘 구조입니다. 실제 DB와 다른 점은 개발자가 조정해 주세요.
-- 앱 프로필(이름·휴대폰·성별·생년월일·이메일)은 기존 public.custom_users 를 쓰는 것을 가정합니다.
--
-- [실제 시스템으로 옮길 때]
--  * 모든 표에 RLS(행 수준 보안)를 켜고, registry.app_users 의 권한으로 접근을 막습니다. (맨 아래 예시)
--  * 접속기록·변경 이력은 트리거/서버 함수에서 남깁니다.
--  * 사진은 Storage 비공개 버킷에 두고 people.photo 에는 경로만 둡니다.
--  * 음력 생일은 조회할 때 그해 양력으로 변환합니다(한국천문연구원 음양력 API 등).
create schema if not exists registry;

-- ============================================================================
-- 회원·권한: 카카오로 회원가입·로그인 → 최고관리자가 승인하고 등급(A·B·C) 지정 → 사용
--   Supabase Auth 의 Kakao 공급자를 씀 (홈페이지와 같은 카카오 로그인).
--   auth.users 에 새 사람이 생기면 트리거로 app_users 에 '승인 대기' 회원을 만듦.
-- ============================================================================
create table registry.grades (                -- 등급마다 할 수 있는 일 (최고관리자가 바꿈)
  grade text primary key check (grade in ('A','B','C')),  -- A 전임 교역자 > B 교적 관리 > C 열람
  name text not null,
  can_edit boolean not null default false,    -- 교적 등록·수정, 출석 등록
  can_export boolean not null default false,  -- 내려받기, 문서 출력(교적부·증명서·요람)
  can_visit boolean not null default false,   -- 심방 열람·등록·녹음 분석, 디모데 메모, 인도자 특이사항
  is_site_admin boolean not null default false -- 설정(교인구분·소그룹·조직표)
);
insert into registry.grades values
  ('A', 'A · 전임 교역자', true, true, true, false),
  ('B', 'B · 교적 관리', true, true, false, false),
  ('C', 'C · 열람', false, false, false, false);

create table registry.app_users (
  user_id uuid primary key,                   -- auth.users.id
  name text not null,                         -- 실명 (가입 때 입력)
  provider text not null default 'kakao',
  kakao_nickname text, email text, phone text,
  person_id uuid,                             -- 교적의 교인과 연결 (아래 people 생성 후 FK 추가)
  status text not null default '승인 대기' check (status in ('승인 대기','사용','정지')),
  grade text references registry.grades(grade), -- 승인 전에는 null
  is_super boolean not null default false,    -- 최고관리자: 가입 승인·등급 지정·등급 설정 (모든 권한)
  requested_at timestamptz not null default now(),
  decided_at timestamptz, decided_by uuid, note text
);
-- 새 카카오 로그인 → 승인 대기 회원 (예시)
create or replace function registry.on_auth_user_created() returns trigger language plpgsql security definer as $$
begin
  insert into registry.app_users (user_id, name, kakao_nickname, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'full_name', '이름 없음'),
          new.raw_user_meta_data->>'name', new.email)
  on conflict (user_id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function registry.on_auth_user_created();

-- ============================================================================
-- 교인구분: 최대 3단계
--   교인 > 장년·새가족·청년부·중고등부·유초등부·유치부·영아부 > 예배출석·가끔출석·불출석(장년만)·장기결석자
--   미등록/타교인 · 별세 · 이사/이민 · 보관 은 1단계. (재적 이력을 남기면 1단계가 자동으로 바뀜 — 트리거)
--   'dead'·'move'·'keep'·'m.a.a' 같은 고정 id 는 지우지 못하게 합니다.
-- ============================================================================
create table registry.categories (
  id text primary key,
  parent_id text references registry.categories(id),
  name text not null, sort_order int not null default 0
);

-- ============================================================================
-- 교적 카드 (사람당 1장)
-- ============================================================================
create table registry.people (
  id uuid primary key default gen_random_uuid(),
  custom_user_id uuid,                        -- 앱 가입자면 custom_users.id (has_account 는 계산)
  name_note text check (name_note ~ '^[A-Z]$'), -- 동명이인 구분: 같은 이름이 있으면 등록 순서대로 A, B, C … (자동)
  birth_lunar boolean not null default false, -- 음력 여부
  reg_no text unique,                         -- 교번
  address_zip text,                           -- 도로명 주소 검색으로 자동 입력 (화면에 칸 없음)
  address1 text, address2 text,               -- 비면 세대 주소 사용
  occupation text,                            -- 직업 / 직장 (화면에서 한 칸)
  workplace text,                             -- 옛 자료용. 새 입력은 occupation 한 칸에
  car_number text,                            -- 차량 번호 (여러 대면 쉼표)
  marital_status text check (marital_status in ('미혼','기혼','이혼','사별','기타')),
  wedding_date date,
  previous_church text,                       -- 이전 출석 교회
  guide_person_id uuid references registry.people(id), -- 인도자: 교인만
  sms_opt_out boolean not null default false, -- 문자 수신 거부
  faith_checked_on date,                      -- 신급 확인일 (원입교인 판정)
  note text,                                  -- 기타 메모
  photo text,                                 -- 사진 (Storage 경로, 3:4로 잘라 작게 저장)
  category_id text references registry.categories(id), -- 교인구분 (3단계 중 한 칸)
  clergy_title text check (clergy_title in ('담임목사','부목사','교육목사','전임전도사','교육전도사')), -- 직분 선택에서 함께 고름
  edu_dept text check (edu_dept in ('영아부','유치부','유초등부','중고등부','청년부')), -- 교인구분 2단계와 같게 자동(통계용)
  mission_society text,                       -- 전도회: 1~6남전도회, 1~10여전도회
  big_family_head_id uuid references registry.people(id), -- 대가족 세대주 (세대와 별개)
  big_family_relation text,
  purged_on date                              -- 전출·별세·제적 5년 뒤 인적사항 지운 날 (보관은 지우지 않음)
);
alter table registry.app_users add foreign key (person_id) references registry.people(id);

-- 세대(가족): 한 사람은 한 세대에만. 교인이 아닌 가족은 이름·출생연도만
create table registry.households (
  id uuid primary key default gen_random_uuid(),
  no text unique not null, zip text, address text, home_phone text, note text
);
create table registry.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references registry.households(id) on delete cascade,
  person_id uuid unique references registry.people(id),  -- unique: 한 사람은 한 세대에만
  name text, birth_year int,
  relation text not null check (relation in ('본인','배우자','자녀','부모','며느리','사위','손자녀','형제자매','기타')),
  sort_order int not null default 0, note text,
  check (person_id is not null or name is not null)
);
create unique index one_head_per_household on registry.household_members(household_id) where relation = '본인';

-- ============================================================================
-- 이력: 지금 값(재적 상태·신급·직분·등록일)은 이력에서 계산
-- ============================================================================
create table registry.status_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  kind text not null check (kind in ('등록','전입','복적','보류','보관','전출','별세','제적')),
  event_date date, reason text, church text   -- church: 전입·전출 교회
);
create table registry.faith_events (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  kind text not null check (kind in ('학습','세례','유아세례','입교')),
  event_date date,                            -- 신급일
  church text,                                -- 신급교회 (비면 본 교회)
  officiant text, note text                   -- 집례자
);
create table registry.office_terms (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  office text not null check (office in ('목사','전도사','사모','장로','시무집사','권사','서리집사')),
  -- 직분마다 고를 수 있는 구분이 다름: 장로(시무·은퇴·원로·협동), 시무집사(시무·은퇴·협동·전입),
  -- 권사(시무·은퇴·협동·전입·명예), 서리집사(서리·명예), 목사·전도사·사모(시무·은퇴 등)
  rank_status text not null check (rank_status in ('시무','은퇴','원로','명예','협동','사임','전입','서리','휴직')), -- 휴직은 장로만
  start_date date,                            -- 임직일
  end_date date,
  church text,                                -- 임직교회 (장로·시무집사·권사, 비면 본 교회)
  note text                                   -- 휴직·무임 등
);

-- ============================================================================
-- 공동체·소그룹: 출석부 자료 (공동체 3개, 소그룹 27개 + 로뎀나무숲)
-- 교적에서는 편성표와 소속을 보여 주고, 출석·인도자 특이사항은 출석부에서 가져옵니다.
-- 출석부가 같은 DB라면 아래 표 대신 출석부 표를 view 로 연결하세요.
-- ============================================================================
create table registry.small_groups (
  id uuid primary key default gen_random_uuid(),
  community text not null check (community in ('뿌리 공동체','줄기 공동체','열매 공동체')),
  name text not null unique, place text,
  leader_id uuid references registry.people(id), -- 인도자
  care boolean not null default false,            -- 자녀 돌봄 편성(로뎀나무숲)
  sort_order int not null default 0
);
create table registry.person_groups (            -- 장년만 소그룹에 속함
  person_id uuid primary key references registry.people(id) on delete cascade,
  small_group_id uuid not null references registry.small_groups(id)
);
create table registry.group_notes (              -- 인도자 특이사항: 심방 권한자만 열람
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  small_group_id uuid references registry.small_groups(id),
  note_date date not null, body text not null, author text
);
-- 출석은 두 가지를 따로 저장합니다. 소그룹에 속한 교인은 한 주일에 기록이 2개 생깁니다.
--   1) 주일 오전예배 출석: 교적 프로그램 '출석' 화면에서 등록
--   2) 주일 오후 소그룹 모임 출석: 홈페이지 출석부에서 소그룹 인도자가 등록 (출석부가 같은 DB라면 출석부 표를 view 로 연결)
create table registry.worship_attendance (       -- 1) 주일 오전예배 출석 (명단 체크)
  sunday date not null,
  person_id uuid not null references registry.people(id) on delete cascade,
  present boolean not null, reason text,          -- 특이사항·사유
  primary key (sunday, person_id)
);
create table registry.worship_totals (           -- 1) 주일 오전예배 전체 출석 인원 (명단 밖 방문자 등 포함, 따로 입력)
  sunday date primary key,
  total int not null check (total >= 0)           -- 그 외 인원 = total - 명단 체크 인원
);
create table registry.group_attendance (         -- 2) 주일 오후 소그룹 모임 출석
  sunday date not null,
  person_id uuid not null references registry.people(id) on delete cascade,
  small_group_id uuid references registry.small_groups(id),  -- 그 주일에 출석한 소그룹
  present boolean not null, reason text,
  primary key (sunday, person_id)
);

-- ============================================================================
-- 메모·동의
-- ============================================================================
create table registry.notes (                    -- 담당자 메모: 교적 사용자 모두 열람
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  body text not null, author uuid, created_at timestamptz not null default now()
);
create table registry.legacy_memos (             -- 옛 디모데 메모: 심방 권한자만, 열 때마다 접속기록
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade, body text not null
);
create table registry.consents (                 -- 새 시스템 시작 시 일괄 동의
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  kind text not null check (kind in ('교적 등록','민감정보','요람 공개','보호자 동의')),
  policy_version text not null, consent_date date,
  method text not null check (method in ('서면','앱','구두')),
  guardian_name text, revoked_on date
);

-- ============================================================================
-- 심방: 최고관리자가 심방 권한을 준 사용자만 열람·등록 (상태 없이 등록, 앞 날짜면 달력에 계획으로 표시)
-- ============================================================================
create table registry.visits (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  visit_date date not null,
  kind text not null,                         -- 심방 구분 (대심방·새신자·일반·병문안 … 디모데 목록 기준)
  method text not null check (method in ('대면','전화')),
  pastor text not null,                       -- 담당 교역자
  companions text,                            -- 동행자: 이름을 쉼표로 (교적에 있는 이름)
  scripture text, hymn text,                  -- 말씀, 찬송
  content text not null, follow_up text,      -- 심방 내용, 후속 조치
  created_by uuid, created_at timestamptz not null default now()
  -- 녹음·문서 분석(/api/visit-analyze)은 파일을 저장하지 않고 결과만 이 칸들에 채웁니다.
);

-- ============================================================================
-- 교회 조직표 (위원회 9개 > 부서: 예배·선교·공동체·교육·재정·관리·봉사·기획·미디어), 교회봉사 소속 (교인마다 최대 3개)
-- ============================================================================
create table registry.org_units (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references registry.org_units(id),
  name text not null, sort_order int not null default 0,
  leader_id uuid references registry.people(id)   -- 위원회: 위원장(장로) / 부서: 부서장
);
create table registry.org_unit_staff (            -- 부서 담당자 (여러 명)
  org_unit_id uuid not null references registry.org_units(id) on delete cascade,
  person_id uuid not null references registry.people(id),
  sort_order int not null default 0,
  primary key (org_unit_id, person_id)
);
create table registry.meeting_officers (          -- 공동의회·당회·제직회 의장·서기
  meeting text primary key check (meeting in ('공동의회','당회','제직회')),
  chair text not null, secretary text not null,   -- 예: '정담임 목사', '홍길동 장로'
  chair_person_id uuid references registry.people(id), secretary_person_id uuid references registry.people(id)
);
create table registry.affiliations (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  org_unit_id uuid not null references registry.org_units(id), -- 프로토타입은 부서 이름으로 저장
  role text, start_date date, end_date date
);

-- ============================================================================
-- 교육 (지금은 새가족 교육만) · 일정(캘린더)
-- ============================================================================
create table registry.education_courses (id uuid primary key default gen_random_uuid(), name text not null);
create table registry.education_records (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references registry.people(id) on delete cascade,
  course_id uuid not null references registry.education_courses(id),
  start_date date, end_date date,             -- end_date: 수료일
  completed boolean not null default false, instructor text, note text
);
-- 생일·결혼기념일·심방 계획은 다른 표에서 계산. 교회 절기(부활주일 등)는 해마다 계산해 넣음
create table registry.events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('성도 기념일','교회 기념일','사역 일정','성례 일정')),
  event_date date not null, end_date date, title text not null,
  person_id uuid references registry.people(id), note text
);

-- ============================================================================
-- 기록
-- ============================================================================
create table registry.access_log (               -- 로그인·검색·열람·수정·내려받기·출력·심방·권한 변경, 3년 보관
  id bigint generated always as identity primary key,
  at timestamptz not null default now(), user_id uuid, action text not null, target text, detail jsonb
);
create table registry.change_log (               -- 수정 전후 값
  id bigint generated always as identity primary key,
  person_id uuid references registry.people(id) on delete cascade,
  at timestamptz not null default now(), by_user uuid, field text, before text, after text
);
create table registry.certificates (             -- 증명서 발급 대장 (교인증명서·세례증명서)
  id bigint generated always as identity primary key,
  doc_no text not null unique,                    -- 예: 제 2026-001 호
  kind text not null, person_id uuid references registry.people(id), purpose text,
  issued_at timestamptz not null default now(), issued_by uuid
);

-- ============================================================================
-- 문자 발송 (솔라피): 자주 쓰는 문구 · 발송 기록
-- ============================================================================
create table registry.sms_templates (            -- 문자 보내기의 자주 쓰는 문구 ([ ] 는 고쳐 쓰는 칸, {이름}·{직분} 은 자동 치환)
  id uuid primary key default gen_random_uuid(),
  title text not null, body text not null, sort_order int not null default 0,
  updated_at timestamptz not null default now(), updated_by uuid
);
create table registry.sms_log (                  -- 발송 기록: 누가 언제 몇 명에게 무엇을
  id uuid primary key default gen_random_uuid(),
  sent_at timestamptz not null default now(), sent_by uuid not null,
  kind text not null check (kind in ('SMS','LMS')), subject text, body text not null,
  recipient_ids uuid[] not null, sent_count int not null, failed_count int not null default 0,
  provider_group_id text                         -- 솔라피 그룹 ID (결과 조회용)
);

-- ============================================================================
-- RLS 예시 (개발 시 모든 표에 적용)
-- ============================================================================
-- 승인된 사용자인지
create or replace function registry.is_member_user() returns boolean language sql stable as $$
  select exists (select 1 from registry.app_users where user_id = auth.uid() and status = '사용')
$$;
-- 심방 권한: A 등급만 (등급 설정·최고관리자 여부와 관계없이 고정). 최고관리자라도 A 가 아니면 안 됨
create or replace function registry.can_visit() returns boolean language sql stable as $$
  select exists (select 1 from registry.app_users u
                 where u.user_id = auth.uid() and u.status = '사용' and u.grade = 'A')
$$;
-- 일괄 수정: 최고관리자만 / 문자 발송: A 등급만 (서버 함수에서 확인)
create or replace function registry.is_super() returns boolean language sql stable as $$
  select exists (select 1 from registry.app_users where user_id = auth.uid() and status = '사용' and is_super)
$$;
alter table registry.people enable row level security;
create policy people_read on registry.people for select using (registry.is_member_user());
alter table registry.visits enable row level security;
create policy visits_all on registry.visits for all using (registry.can_visit()) with check (registry.can_visit());
alter table registry.legacy_memos enable row level security;
create policy memos_read on registry.legacy_memos for select using (registry.can_visit());
alter table registry.group_notes enable row level security;
create policy group_notes_read on registry.group_notes for select using (registry.can_visit());
-- app_users·grades: 본인 행은 읽기, 승인·등급 변경은 최고관리자만 (서버 함수에서 처리 권장)
