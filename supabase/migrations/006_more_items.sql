-- Gift, voice, drawing, location and news items. Run once in Supabase → SQL Editor (after 005).

-- Voice notes are audio uploads; drawings are PNGs (already allowed as images).
update storage.buckets
set allowed_mime_types = array['image/*', 'video/*', 'audio/*']
where id = 'attachments';

-- Dashboard: counts for the new types (appended, so the view can be replaced).
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
  p.opened_at,
  count(*) filter (where pi.item_type = 'gift')       as gifts,
  count(*) filter (where pi.item_type = 'voice')      as voices,
  count(*) filter (where pi.item_type = 'drawing')    as drawings,
  count(*) filter (where pi.item_type = 'location')   as locations,
  count(*) filter (where pi.item_type = 'news')       as news
from public.packages p
left join admin.package_items pi on pi.package_id = p.id
group by p.id
order by p.created_at desc;

create or replace view admin.gifts as
select package_id, env, created_at, to_name, from_name, position,
       item->>'url'  as gift_url,
       item->>'note' as note
from admin.package_items where item_type = 'gift'
order by created_at desc, position;

create or replace view admin.voices as
select package_id, env, created_at, to_name, from_name, position,
       item->>'src' as audio_url,
       case when item->>'seconds' ~ '^\d{1,4}$' then (item->>'seconds')::int end as seconds
from admin.package_items where item_type = 'voice'
order by created_at desc, position;

create or replace view admin.drawings as
select package_id, env, created_at, to_name, from_name, position,
       item->>'src'     as drawing_url,
       item->>'caption' as caption
from admin.package_items where item_type = 'drawing'
order by created_at desc, position;

create or replace view admin.locations as
select package_id, env, created_at, to_name, from_name, position,
       item->>'name' as place,
       item->>'url'  as map_url,
       item->>'note' as note
from admin.package_items where item_type = 'location'
order by created_at desc, position;

create or replace view admin.news as
select package_id, env, created_at, to_name, from_name, position,
       item->>'url'      as article_url,
       item->>'headline' as headline,
       item->>'note'     as note
from admin.package_items where item_type = 'news'
order by created_at desc, position;

revoke all on all tables in schema admin from public, anon, authenticated;
