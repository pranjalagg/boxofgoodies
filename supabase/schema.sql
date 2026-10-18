-- Run once in Supabase → SQL Editor.

-- Packages: anyone can create one; reading needs the exact id (no listing).
create table if not exists public.packages (
  id uuid primary key,
  data jsonb not null,
  created_at timestamptz not null default now()
);

alter table public.packages enable row level security;

drop policy if exists "anon can create packages" on public.packages;
create policy "anon can create packages"
  on public.packages for insert to anon
  with check (pg_column_size(data) < 200000);

-- No select policy: reads go through this function, so nobody can dump the table.
create or replace function public.get_package(pid uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select data from public.packages where id = pid;
$$;

revoke all on function public.get_package(uuid) from public;
grant execute on function public.get_package(uuid) to anon, authenticated;

-- Attachments: public-read bucket (files served by unguessable URL), 50MB cap, images/videos only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('attachments', 'attachments', true, 52428800, array['image/*', 'video/*'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon can upload attachments" on storage.objects;
create policy "anon can upload attachments"
  on storage.objects for insert to anon
  with check (bucket_id = 'attachments');
