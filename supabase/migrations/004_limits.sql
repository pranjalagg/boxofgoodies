-- Abuse limits. Run once in Supabase → SQL Editor (after 002 and 003).
--
-- After this, the anon key can no longer insert into packages directly. New packages go
-- through create_package(), which checks shape, size and rate limits. Uploads are only
-- accepted into the folder of a package created in the last 15 minutes.

create extension if not exists pgcrypto with schema extensions;

-- Nothing gets tagged 'prod' unless the production build says so.
alter table public.packages alter column env set default 'dev';

-- Hashed client IP, for rate limiting only. The raw IP is never stored.
alter table public.packages add column if not exists ip_hash text;
create index if not exists packages_ip_recent_idx on public.packages (ip_hash, created_at desc);
create index if not exists packages_created_idx on public.packages (created_at desc);

drop policy if exists "anon can create packages" on public.packages;
revoke insert, update, delete on public.packages from anon, authenticated;

create or replace function public.create_package(pid uuid, penv text, pdata jsonb)
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
  if (select count(*) from packages where ip_hash = iph and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'you''ve sent a lot of packages this hour, try again a bit later';
  end if;
  if (select count(*) from packages where created_at > now() - interval '1 day') >= 500 then
    raise exception 'the post office is closed for today, try again tomorrow';
  end if;

  insert into packages (id, env, data, ip_hash) values (pid, penv, pdata, iph);
end;
$$;

revoke all on function public.create_package(uuid, text, jsonb) from public;
grant execute on function public.create_package(uuid, text, jsonb) to anon, authenticated;

-- Upload gate: path must be <env>/<package id>/<file>, the package must match that env,
-- be under 15 minutes old, and its folder must hold fewer than 20 files.
create or replace function public.can_upload(object_name text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
      select 1 from public.packages p
      where p.id::text = (storage.foldername(object_name))[2]
        and p.env = (storage.foldername(object_name))[1]
        and p.created_at > now() - interval '15 minutes'
    )
    and (
      select count(*) from storage.objects o
      where o.bucket_id = 'attachments'
        and (storage.foldername(o.name))[2] = (storage.foldername(object_name))[2]
    ) < 20;
$$;

revoke all on function public.can_upload(text) from public;
grant execute on function public.can_upload(text) to anon, authenticated;

drop policy if exists "anon can upload attachments" on storage.objects;
create policy "anon can upload attachments"
  on storage.objects for insert to anon
  with check (bucket_id = 'attachments' and public.can_upload(name));
