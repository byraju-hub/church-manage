-- 교적관리 스키마 (프로토타입 기준안)
-- src/lib/types.ts 및 src/lib/mock/seed.ts 와 1:1로 대응합니다.

-- 구역(목장/셀)
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- 예: 1구역
  leader_member_id uuid,              -- 구역장 (members.id), 아래에서 FK 추가
  created_at timestamptz not null default now()
);

-- 가정(세대) 단위
create table public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,                 -- 예: 김철수 가정
  address text,
  created_at timestamptz not null default now()
);

-- 교인
create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text check (gender in ('M', 'F')),
  birth_date date,
  phone text,
  email text,
  address text,
  photo_url text,

  family_id uuid references public.families(id) on delete set null,
  family_relation text,               -- 세대주, 배우자, 자녀, 부모 등
  group_id uuid references public.groups(id) on delete set null,

  status text not null default 'active'
    check (status in ('newcomer', 'active', 'inactive', 'transferred', 'deceased')),
                                      -- 새가족, 등록교인, 휴적, 이명, 소천
  position text,                      -- 직분: 목사, 장로, 권사, 안수집사, 집사, 성도 등
  registered_at date,                 -- 등록일
  baptism_type text check (baptism_type in ('infant', 'adult', 'none')),
  baptism_date date,
  previous_church text,
  memo text,
  created_at timestamptz not null default now()
);

alter table public.groups
  add constraint groups_leader_fk
  foreign key (leader_member_id) references public.members(id) on delete set null;

-- 출석
create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  service_date date not null,
  service_type text not null,         -- 주일1부, 주일2부, 수요예배, 새벽기도 등
  present boolean not null default true,
  unique (member_id, service_date, service_type)
);

-- 심방 기록
create table public.visits (
  id uuid primary key default gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete cascade,
  visit_date date not null,
  visit_type text,                    -- 정기심방, 병원심방, 새가족심방 등
  visited_by text,
  content text,
  created_at timestamptz not null default now()
);

-- RLS: 실제 구현 시 역할(목사/교역자/구역장)별 정책으로 세분화 필요
alter table public.groups enable row level security;
alter table public.families enable row level security;
alter table public.members enable row level security;
alter table public.attendance enable row level security;
alter table public.visits enable row level security;

create policy "authenticated all" on public.groups for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.families for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.members for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.attendance for all to authenticated using (true) with check (true);
create policy "authenticated all" on public.visits for all to authenticated using (true) with check (true);
