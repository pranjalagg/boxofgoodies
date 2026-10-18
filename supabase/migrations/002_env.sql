-- Run once in Supabase → SQL Editor if you already ran schema.sql before the env split.
-- Tags each package as 'dev' (made from localhost) or 'prod' (made on the deployed site).

alter table public.packages
  add column if not exists env text not null default 'prod'
  check (env in ('dev', 'prod'));

create index if not exists packages_env_idx on public.packages (env);

-- Anything created before this migration came from local testing.
-- Skip this line if real users have already sent packages from the deployed site.
update public.packages set env = 'dev';

-- Uploads must live under dev/ or prod/.
drop policy if exists "anon can upload attachments" on storage.objects;
create policy "anon can upload attachments"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'attachments'
    and (storage.foldername(name))[1] in ('dev', 'prod')
  );
