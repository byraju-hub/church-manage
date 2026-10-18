-- 교적관리 초기 스키마
create table public.members (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  birth_date date,
  address text,
  baptized boolean not null default false,
  position text,
  memo text,
  created_at timestamptz not null default now()
);

alter table public.members enable row level security;

-- 로그인한 사용자만 접근 (세부 권한은 이후 역할 테이블로 확장)
create policy "authenticated can read members" on public.members
  for select to authenticated using (true);
create policy "authenticated can write members" on public.members
  for all to authenticated using (true) with check (true);
