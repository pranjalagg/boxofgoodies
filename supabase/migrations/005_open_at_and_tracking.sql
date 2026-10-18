-- "Don't open until" and "opened" notices. Run once in Supabase → SQL Editor (after 004).
--
-- open_at:    contents stay hidden (server-side) until this time
-- opened_at:  first time the recipient tapped the box open
-- track_hash: sha256 of the sender's private tracking token; the token itself is never stored

alter table public.packages add column if not exists open_at timestamptz;
alter table public.packages add column if not exists opened_at timestamptz;
alter table public.packages add column if not exists track_hash text;

-- create_package gains the tracking token, so replace the 3-argument version.
drop function if exists public.create_package(uuid, text, jsonb);

create or replace function public.create_package(pid uuid, penv text, pdata jsonb, ptrack text default null)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  headers json := coalesce(current_setting('request.headers', true), '{}')::json;
  -- Best effort: the first X-Forwarded-For hop can be set by the client, so a determined
  -- sender can dodge the per-IP limit. The daily cap below still holds for everyone.
  client_ip text := coalesce(
    nullif(headers->>'cf-connecting-ip', ''),
    nullif(trim(split_part(headers->>'x-forwarded-for', ',', 1)), ''),
    'unknown');
  iph text := encode(digest(client_ip, 'sha256'), 'hex');
  n_items int;
  open_ts timestamptz;
begin
  if penv is null or penv not in ('dev', 'prod') then
    raise exception 'invalid environment';
  end if;
  if jsonb_typeof(pdata) is distinct from 'object' or jsonb_typeof(pdata->'items') is distinct from 'array' then
    raise exception 'invalid package';
  end if;
  n_items := jsonb_array_length(pdata->'items');
  if n_items < 1 or n_items > 20 then
    raise exception 'a box holds 1 to 20 things';
  end if;
  if pg_column_size(pdata) > 200000 then
    raise exception 'this package is too big';
  end if;
  if nullif(pdata->>'openAt', '') is not null then
    begin
      open_ts := (pdata->>'openAt')::timestamptz;
    exception when others then
      raise exception 'invalid "don''t open until" date';
    end;
    if open_ts > now() + interval '400 days' then
      raise exception 'pick a "don''t open until" date within a year';
    end if;
    if open_ts <= now() then
      open_ts := null;
    end if;
  end if;
  if ptrack is not null and ptrack !~ '^[0-9a-f]{32,64}$' then
    raise exception 'invalid tracking token';
  end if;
  if (select count(*) from packages where ip_hash = iph and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'you''ve sent a lot of packages this hour, try again a bit later';
  end if;
  if (select count(*) from packages where created_at > now() - interval '1 day') >= 500 then
    raise exception 'the post office is closed for today, try again tomorrow';
  end if;

  insert into packages (id, env, data, ip_hash, open_at, track_hash)
  values (pid, penv, pdata - 'openAt', iph, open_ts,
          case when ptrack is null then null else encode(digest(ptrack, 'sha256'), 'hex') end);
end;
$$;

revoke all on function public.create_package(uuid, text, jsonb, text) from public;
grant execute on function public.create_package(uuid, text, jsonb, text) to anon, authenticated;

-- While sealed, only the envelope comes back: names, open time, item count. No contents.
create or replace function public.get_package(pid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.open_at is not null and p.open_at > now() then
      jsonb_build_object(
        'to', p.data->'to',
        'from', p.data->'from',
        'openAt', p.open_at,
        'sealed', true,
        'count', jsonb_array_length(p.data->'items'))
    else
      p.data || jsonb_build_object('openAt', p.open_at)
  end
  from public.packages p
  where p.id = pid;
$$;

revoke all on function public.get_package(uuid) from public;
grant execute on function public.get_package(uuid) to anon, authenticated;

-- Records only the first opening, and never before the open time.
create or replace function public.mark_opened(pid uuid)
returns void
language sql
volatile
security definer
set search_path = public
as $$
  update public.packages
  set opened_at = now()
  where id = pid
    and opened_at is null
    and (open_at is null or open_at <= now());
$$;

revoke all on function public.mark_opened(uuid) from public;
grant execute on function public.mark_opened(uuid) to anon, authenticated;

-- Sender's view. Needs the tracking token, so a recipient's link alone can't read it.
create or replace function public.get_status(pid uuid, ptrack text)
returns jsonb
language sql
stable
security definer
set search_path = public, extensions
as $$
  select jsonb_build_object(
    'to', p.data->'to',
    'createdAt', p.created_at,
    'openAt', p.open_at,
    'openedAt', p.opened_at)
  from public.packages p
  where p.id = pid
    and p.track_hash is not null
    and p.track_hash = encode(digest(ptrack, 'sha256'), 'hex');
$$;

revoke all on function public.get_status(uuid, text) from public;
grant execute on function public.get_status(uuid, text) to anon, authenticated;

-- Dashboard: show the new columns in the overview (appended, so the view can be replaced).
create or replace view admin.packages_overview as
select
  p.id as package_id,
  p.env,
  p.created_at,
  p.data->>'to'   as to_name,
  p.data->>'from' as from_name,
  count(pi.item)                                      as total_items,
  count(*) filter (where pi.item_type = 'note')       as notes,
  count(*) filter (where pi.item_type = 'photo')      as photos,
  count(*) filter (where pi.item_type = 'song')       as songs,
  count(*) filter (where pi.item_type = 'video')      as videos,
  count(*) filter (where pi.item_type = 'coupon')     as coupons,
  p.open_at,
  p.opened_at
from public.packages p
left join admin.package_items pi on pi.package_id = p.id
group by p.id
order by p.created_at desc;

revoke all on all tables in schema admin from public, anon, authenticated;
