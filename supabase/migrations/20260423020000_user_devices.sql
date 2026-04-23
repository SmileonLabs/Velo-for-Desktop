-- Velo 기기 페어링 테이블.
-- "폰 ↔ 데스크탑 동기화"를 위해 같은 Velo 계정에 로그인된 기기들의 메타데이터를 서로 찾을 수 있게 한다.
--
-- 실제 파일 전송은 LAN/핫스팟 직결 (Supabase 경유 X).
-- 이 테이블은 "누가 어디에 있는지" (기기 목록 + 최근 로컬 IP) 교환 용도만.
--
-- 프라이버시 관점:
--   - 이메일/이름 X. device_name은 유저가 입력한 라벨 ("도도 맥북" 등).
--   - local_ip는 RFC1918 사설 IP라 외부 식별 불가.
--   - RLS로 본인 기기만 보도록 강제.

create table if not exists public.user_devices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  device_id       text not null,                                  -- 기기 고유 ID (iOS: identifierForVendor, Android: androidId, Desktop: machine UUID)
  device_name     text not null,                                  -- 유저 표시용 라벨 ("도도 MacBook")
  platform        text not null check (platform in ('ios', 'android', 'macos', 'windows', 'linux')),
  app_version     text,
  local_ip        text,                                           -- 마지막 관측된 LAN IP (RFC1918). nullable — 네트워크 변경되면 갱신
  mdns_name       text,                                           -- mDNS discovery용 host 이름 (선택)
  port            int,                                            -- 데스크탑 HTTP 서버 포트 (데스크탑만 기록)
  is_receiver     boolean not null default false,                 -- true = 파일 받을 수 있는 기기 (데스크탑). false = 보내기만 (폰)
  last_seen_at    timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  unique (user_id, device_id)
);

-- 본인 기기 목록 조회 인덱스
create index if not exists user_devices_user_idx
  on public.user_devices (user_id, last_seen_at desc);

-- RLS: 본인 계정 기기만 조회/수정 가능
alter table public.user_devices enable row level security;

drop policy if exists "users can see own devices" on public.user_devices;
create policy "users can see own devices"
  on public.user_devices
  for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users can register own devices" on public.user_devices;
create policy "users can register own devices"
  on public.user_devices
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users can update own devices" on public.user_devices;
create policy "users can update own devices"
  on public.user_devices
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "users can delete own devices" on public.user_devices;
create policy "users can delete own devices"
  on public.user_devices
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- 자동 last_seen_at 갱신 트리거 (upsert 시 updated 간주)
create or replace function public.touch_user_devices_last_seen()
returns trigger
language plpgsql
as $$
begin
  new.last_seen_at = now();
  return new;
end;
$$;

drop trigger if exists user_devices_touch on public.user_devices;
create trigger user_devices_touch
  before update on public.user_devices
  for each row
  execute function public.touch_user_devices_last_seen();
