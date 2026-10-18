-- Read-only views for browsing packages in the Supabase dashboard.
-- Run once in Supabase → SQL Editor (after schema.sql / 002_env.sql), then pick the
-- "admin" schema in Table Editor.
--
-- These live in their own schema on purpose: the API only exposes "public", and views
-- bypass row-level security, so putting them in "public" would let anyone with the
-- anon key read every package.

create schema if not exists admin;
revoke all on schema admin from public, anon, authenticated;

-- One row per item, in the order it was tucked into the box.
create or replace view admin.package_items as
select
  p.id           as package_id,
  p.env,
  p.created_at,
  p.data->>'to'   as to_name,
  p.data->>'from' as from_name,
  i.ord::int     as position,
  i.item->>'type' as item_type,
  i.item
from public.packages p
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.data->'items') = 'array' then p.data->'items' else '[]'::jsonb end
) with ordinality as i(item, ord);

-- One row per package with item counts.
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
  count(*) filter (where pi.item_type = 'coupon')     as coupons
from public.packages p
left join admin.package_items pi on pi.package_id = p.id
group by p.id
order by p.created_at desc;

create or replace view admin.notes as
select package_id, env, created_at, to_name, from_name, position,
       item->>'text' as note
from admin.package_items where item_type = 'note'
order by created_at desc, position;

create or replace view admin.photos as
select package_id, env, created_at, to_name, from_name, position,
       item->>'caption' as caption,
       item->>'src'     as photo_url,
       item->>'mime'    as mime
from admin.package_items where item_type = 'photo'
order by created_at desc, position;

create or replace view admin.songs as
select package_id, env, created_at, to_name, from_name, position,
       item->>'url'     as song_url,
       item->>'caption' as caption
from admin.package_items where item_type = 'song'
order by created_at desc, position;

create or replace view admin.videos as
select package_id, env, created_at, to_name, from_name, position,
       coalesce(item->>'src', item->>'url') as video_url,
       case when item ? 'src' then 'upload' else 'link' end as source,
       item->>'caption' as caption
from admin.package_items where item_type = 'video'
order by created_at desc, position;

create or replace view admin.coupons as
select package_id, env, created_at, to_name, from_name, position,
       item->>'title'   as good_for,
       item->>'details' as fine_print,
       item->>'expires' as expires
from admin.package_items where item_type = 'coupon'
order by created_at desc, position;

-- Belt and braces: no API role can read these even if the schema is exposed later.
revoke all on all tables in schema admin from public, anon, authenticated;
