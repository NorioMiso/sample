-- =============================================================
-- sanpostar: Initial Schema
-- =============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "postgis";  -- for geospatial route data

-- =============================================================
-- ENUM TYPES
-- =============================================================

create type weather_condition as enum (
  'sunny', 'cloudy', 'rainy', 'snowy', 'foggy', 'windy'
);

create type time_of_day_category as enum (
  'morning',    -- 05:00–09:59
  'daytime',    -- 10:00–15:59
  'evening',    -- 16:00–19:59
  'night',      -- 20:00–23:59
  'midnight'    -- 00:00–04:59
);

create type praise_type as enum (
  'daily',          -- AI-generated daily ranking praise
  'personal_best'   -- milestone praise (100km, 10-day streak, etc.)
);

create type badge_category as enum (
  'streak',
  'distance',
  'weather',
  'time_of_day',
  'community',
  'course',
  'special'
);

create type notification_type as enum (
  'praise_daily',
  'personal_best',
  'badge_earned',
  'nice_sanpo',
  'comment',
  'new_favorite'
);

-- =============================================================
-- USERS
-- =============================================================

create table users (
  id              uuid primary key default uuid_generate_v4(),
  auth_id         uuid unique references auth.users(id) on delete cascade,
  nickname        text not null,
  icon_url        text,
  bio             text,
  birth_year      int check (birth_year between 1900 and 2100),
  -- denormalized age group for efficient ranking queries
  -- now() is not immutable so we cannot use a generated column;
  -- this column is maintained by trg_users_age_group instead.
  age_group       text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =============================================================
-- WALK RECORDS
-- =============================================================

create table walk_records (
  id                    uuid primary key default uuid_generate_v4(),
  user_id               uuid not null references users(id) on delete cascade,

  -- timing
  started_at            timestamptz not null,
  ended_at              timestamptz not null,
  duration_seconds      int not null generated always as (
    extract(epoch from (ended_at - started_at))::int
  ) stored,

  -- distance / activity
  distance_meters       int not null check (distance_meters >= 0),
  steps                 int,
  calories              int,

  -- contextual metadata (denormalized for fast ranking queries)
  -- 'Asia/Tokyo' is not immutable (DST table lookup); use UTC + fixed 9h offset instead.
  walked_date           date not null generated always as (
    (started_at at time zone 'UTC' + interval '9 hours')::date
  ) stored,
  day_of_week           int not null generated always as (
    extract(dow from (started_at at time zone 'UTC' + interval '9 hours'))::int  -- 0=Sun … 6=Sat
  ) stored,
  month                 int not null generated always as (
    extract(month from (started_at at time zone 'UTC' + interval '9 hours'))::int
  ) stored,
  year                  int not null generated always as (
    extract(year from (started_at at time zone 'UTC' + interval '9 hours'))::int
  ) stored,
  time_of_day           time_of_day_category not null,
  weather               weather_condition,

  -- visibility
  is_public             boolean not null default false,

  created_at            timestamptz not null default now()
);

-- =============================================================
-- WALK ROUTES  (GPS path stored as GeoJSON LineString)
-- =============================================================

create table walk_routes (
  id              uuid primary key default uuid_generate_v4(),
  walk_record_id  uuid not null unique references walk_records(id) on delete cascade,
  -- PostGIS geometry: LINESTRING(lng lat, ...)
  geom            geometry(LineString, 4326),
  -- raw GeoJSON fallback if PostGIS not available
  route_geojson   jsonb,
  created_at      timestamptz not null default now()
);

-- =============================================================
-- WALK STATS  (aggregated per user — updated by triggers)
-- =============================================================

create table walk_stats (
  user_id                   uuid primary key references users(id) on delete cascade,
  total_distance_meters     bigint  not null default 0,
  total_walks               int     not null default 0,
  total_duration_seconds    bigint  not null default 0,
  this_month_distance_meters bigint not null default 0,
  this_month_walks          int     not null default 0,
  today_distance_meters     int     not null default 0,
  today_walks               int     not null default 0,
  current_streak_days       int     not null default 0,
  longest_streak_days       int     not null default 0,
  last_walked_date          date,
  updated_at                timestamptz not null default now()
);

-- =============================================================
-- COURSE POSTS  (shared walking courses)
-- =============================================================

create table course_posts (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,
  walk_record_id  uuid references walk_records(id) on delete set null,

  title           text not null,
  comment         text,
  route_geojson   jsonb,          -- course map route

  -- denormalized counters (updated by triggers)
  nice_count      int  not null default 0,
  walked_count    int  not null default 0,
  comment_count   int  not null default 0,

  is_public       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- =============================================================
-- COURSE PHOTOS
-- =============================================================

create table course_photos (
  id              uuid primary key default uuid_generate_v4(),
  course_post_id  uuid not null references course_posts(id) on delete cascade,
  photo_url       text not null,
  order_index     int  not null default 0,
  created_at      timestamptz not null default now()
);

-- =============================================================
-- NICE SANPO!  (likes on course posts)
-- =============================================================

create table nice_sanpos (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,
  course_post_id  uuid not null references course_posts(id) on delete cascade,
  created_at      timestamptz not null default now(),
  unique (user_id, course_post_id)
);

-- =============================================================
-- COURSE WALKS  (tracking who has walked a shared course)
-- =============================================================

create table course_walks (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,
  course_post_id  uuid not null references course_posts(id) on delete cascade,
  walked_at       timestamptz not null default now(),
  unique (user_id, course_post_id)   -- one entry per user per course
);

-- =============================================================
-- COURSE COMMENTS  (supports threaded replies + photo attachments)
-- =============================================================

create table course_comments (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references users(id) on delete cascade,
  course_post_id    uuid not null references course_posts(id) on delete cascade,
  parent_comment_id uuid references course_comments(id) on delete cascade,  -- null = top-level
  body              text not null,
  photo_url         text,       -- optional photo reply
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- =============================================================
-- FAVORITE SANPOSTERS  (user-to-user follows)
-- =============================================================

create table favorite_sanposters (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,   -- who favorited
  target_user_id  uuid not null references users(id) on delete cascade,   -- who is favorited
  created_at      timestamptz not null default now(),
  unique (user_id, target_user_id),
  check (user_id <> target_user_id)
);

-- =============================================================
-- PRAISES  (AI-generated 称え)
-- =============================================================

create table praises (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references users(id) on delete cascade,
  walk_record_id      uuid references walk_records(id) on delete set null,

  praise_type         praise_type not null,
  praise_text         text not null,          -- final text sent to user

  -- ranking context (stored for display and audit)
  ranking_conditions  jsonb,   -- e.g. {"weather":"rainy","time_of_day":"midnight","age_group":"30s","day_of_week":4}
  rank                int,     -- actual rank (1-based)
  total_count         int,     -- total users in the filtered group

  -- personal best specific
  milestone_type      text,    -- e.g. "total_distance_100km", "streak_10days"
  milestone_value     numeric, -- the actual value reached

  -- user interaction
  is_pinned           boolean not null default false,  -- pinned to hall of fame
  is_read             boolean not null default false,

  created_at          timestamptz not null default now()
);

-- =============================================================
-- BADGES  (badge definitions — seeded data)
-- =============================================================

create table badges (
  id                uuid primary key default uuid_generate_v4(),
  slug              text unique not null,   -- e.g. "streak_10", "rain_walker"
  name              text not null,
  description       text not null,
  icon_url          text,
  category          badge_category not null,
  -- condition used by the badge-check job
  condition_type    text not null,          -- e.g. "streak_days", "total_distance_meters", "walk_in_rain"
  condition_value   numeric,               -- e.g. 10, 100000, null (for boolean conditions)
  is_secret         boolean not null default false,  -- hidden until earned
  created_at        timestamptz not null default now()
);

-- =============================================================
-- USER BADGES
-- =============================================================

create table user_badges (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references users(id) on delete cascade,
  badge_id    uuid not null references badges(id) on delete cascade,
  earned_at   timestamptz not null default now(),
  unique (user_id, badge_id)
);

-- =============================================================
-- NOTIFICATIONS
-- =============================================================

create table notifications (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references users(id) on delete cascade,
  type            notification_type not null,
  title           text not null,
  body            text,
  -- polymorphic reference to the related entity
  related_id      uuid,
  related_type    text,   -- 'praise', 'badge', 'course_post', 'comment', 'user'
  is_read         boolean not null default false,
  created_at      timestamptz not null default now()
);

-- =============================================================
-- INDEXES
-- =============================================================

-- walk_records: frequent ranking queries
create index idx_walk_records_user_id        on walk_records(user_id);
create index idx_walk_records_walked_date    on walk_records(walked_date);
create index idx_walk_records_weather        on walk_records(weather);
create index idx_walk_records_time_of_day    on walk_records(time_of_day);
create index idx_walk_records_day_of_week    on walk_records(day_of_week);
create index idx_walk_records_month_year     on walk_records(year, month);
create index idx_walk_records_public         on walk_records(is_public) where is_public = true;

-- course_posts
create index idx_course_posts_user_id        on course_posts(user_id);
create index idx_course_posts_public         on course_posts(is_public, created_at desc);

-- praises
create index idx_praises_user_id             on praises(user_id);
create index idx_praises_pinned              on praises(user_id, is_pinned) where is_pinned = true;
create index idx_praises_unread              on praises(user_id, is_read) where is_read = false;

-- nice_sanpos / course_walks / favorite_sanposters
create index idx_nice_sanpos_course          on nice_sanpos(course_post_id);
create index idx_course_walks_course         on course_walks(course_post_id);
create index idx_favorite_sanposters_target  on favorite_sanposters(target_user_id);

-- notifications
create index idx_notifications_user_unread   on notifications(user_id, is_read) where is_read = false;

-- =============================================================
-- TRIGGERS: auto-update updated_at
-- =============================================================

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_users_updated_at
  before update on users
  for each row execute function set_updated_at();

-- age_group は now() を使うため generated column にできない → トリガーで管理
create or replace function set_age_group()
returns trigger language plpgsql as $$
declare
  current_year int := extract(year from now())::int;
  age int;
begin
  if new.birth_year is null then
    new.age_group := 'unknown';
  else
    age := current_year - new.birth_year;
    new.age_group := case
      when age < 20 then 'teens'
      when age < 30 then '20s'
      when age < 40 then '30s'
      when age < 50 then '40s'
      when age < 60 then '50s'
      else '60+'
    end;
  end if;
  return new;
end;
$$;

create trigger trg_users_age_group
  before insert or update of birth_year on users
  for each row execute function set_age_group();

create trigger trg_course_posts_updated_at
  before update on course_posts
  for each row execute function set_updated_at();

create trigger trg_course_comments_updated_at
  before update on course_comments
  for each row execute function set_updated_at();

-- =============================================================
-- TRIGGERS: maintain denormalized counters on course_posts
-- =============================================================

create or replace function update_nice_count()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') then
    update course_posts set nice_count = nice_count + 1 where id = new.course_post_id;
  elsif (TG_OP = 'DELETE') then
    update course_posts set nice_count = greatest(nice_count - 1, 0) where id = old.course_post_id;
  end if;
  return null;
end;
$$;

create trigger trg_nice_sanpos_count
  after insert or delete on nice_sanpos
  for each row execute function update_nice_count();

create or replace function update_walked_count()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') then
    update course_posts set walked_count = walked_count + 1 where id = new.course_post_id;
  elsif (TG_OP = 'DELETE') then
    update course_posts set walked_count = greatest(walked_count - 1, 0) where id = old.course_post_id;
  end if;
  return null;
end;
$$;

create trigger trg_course_walks_count
  after insert or delete on course_walks
  for each row execute function update_walked_count();

create or replace function update_comment_count()
returns trigger language plpgsql as $$
begin
  if (TG_OP = 'INSERT') then
    update course_posts set comment_count = comment_count + 1 where id = new.course_post_id;
  elsif (TG_OP = 'DELETE') then
    update course_posts set comment_count = greatest(comment_count - 1, 0) where id = old.course_post_id;
  end if;
  return null;
end;
$$;

create trigger trg_course_comments_count
  after insert or delete on course_comments
  for each row execute function update_comment_count();

-- =============================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================

alter table users                 enable row level security;
alter table walk_records          enable row level security;
alter table walk_routes           enable row level security;
alter table walk_stats            enable row level security;
alter table course_posts          enable row level security;
alter table course_photos         enable row level security;
alter table nice_sanpos           enable row level security;
alter table course_walks          enable row level security;
alter table course_comments       enable row level security;
alter table favorite_sanposters   enable row level security;
alter table praises               enable row level security;
alter table badges                enable row level security;
alter table user_badges           enable row level security;
alter table notifications         enable row level security;

-- helpers
create or replace function auth_uid() returns uuid language sql stable as $$
  select auth.uid()
$$;

create or replace function my_user_id() returns uuid language sql stable as $$
  select id from users where auth_id = auth.uid()
$$;

-- users: anyone can read public profiles; only self can update
create policy "users: public read"   on users for select using (true);
create policy "users: self insert"   on users for insert with check (auth_id = auth.uid());
create policy "users: self update"   on users for update using (auth_id = auth.uid());

-- walk_records: owner sees all; others see only public
create policy "walk_records: owner all"   on walk_records for all   using (user_id = my_user_id());
create policy "walk_records: public read" on walk_records for select using (is_public = true);

-- walk_routes: same visibility as parent walk_record
create policy "walk_routes: owner all" on walk_routes for all using (
  walk_record_id in (select id from walk_records where user_id = my_user_id())
);
create policy "walk_routes: public read" on walk_routes for select using (
  walk_record_id in (select id from walk_records where is_public = true)
);

-- walk_stats: owner read/write only
create policy "walk_stats: owner all" on walk_stats for all using (user_id = my_user_id());

-- course_posts: public posts visible to all; owner manages own
create policy "course_posts: public read" on course_posts for select using (is_public = true);
create policy "course_posts: owner all"   on course_posts for all   using (user_id = my_user_id());

-- course_photos: follow parent post visibility
create policy "course_photos: public read" on course_photos for select using (
  course_post_id in (select id from course_posts where is_public = true)
);
create policy "course_photos: owner all" on course_photos for all using (
  course_post_id in (select id from course_posts where user_id = my_user_id())
);

-- nice_sanpos: authenticated users can insert/delete own; anyone can read counts
create policy "nice_sanpos: read all"    on nice_sanpos for select using (true);
create policy "nice_sanpos: auth insert" on nice_sanpos for insert with check (user_id = my_user_id());
create policy "nice_sanpos: own delete"  on nice_sanpos for delete using (user_id = my_user_id());

-- course_walks: authenticated insert; public read
create policy "course_walks: read all"    on course_walks for select using (true);
create policy "course_walks: auth insert" on course_walks for insert with check (user_id = my_user_id());

-- course_comments: public read; authenticated insert; owner delete/update
create policy "course_comments: read all"   on course_comments for select using (true);
create policy "course_comments: auth insert" on course_comments for insert with check (user_id = my_user_id());
create policy "course_comments: own update"  on course_comments for update using (user_id = my_user_id());
create policy "course_comments: own delete"  on course_comments for delete using (user_id = my_user_id());

-- favorite_sanposters: own records
create policy "favorite_sanposters: read all"    on favorite_sanposters for select using (true);
create policy "favorite_sanposters: own insert"  on favorite_sanposters for insert with check (user_id = my_user_id());
create policy "favorite_sanposters: own delete"  on favorite_sanposters for delete using (user_id = my_user_id());

-- praises: owner only
create policy "praises: owner all" on praises for all using (user_id = my_user_id());

-- badges: public read
create policy "badges: public read" on badges for select using (true);

-- user_badges: public read (profile display); insert by service role only
create policy "user_badges: public read" on user_badges for select using (true);

-- notifications: owner only
create policy "notifications: owner all" on notifications for all using (user_id = my_user_id());

-- =============================================================
-- SEED: Badge definitions
-- =============================================================

insert into badges (slug, name, description, category, condition_type, condition_value) values
  -- streak badges
  ('streak_3',      '3日連続サンポスター',  '3日連続で散歩を記録した',       'streak',    'streak_days',             3),
  ('streak_10',     '10日連続サンポスター', '10日連続で散歩を記録した',       'streak',    'streak_days',            10),
  ('streak_30',     '30日連続サンポスター', '30日連続で散歩を記録した',       'streak',    'streak_days',            30),
  ('streak_100',    '100日連続サンポスター','100日連続で散歩を記録した',      'streak',    'streak_days',           100),

  -- distance badges
  ('distance_10km',   '10km達成',   '累計10kmを歩いた',    'distance', 'total_distance_meters',  10000),
  ('distance_50km',   '50km達成',   '累計50kmを歩いた',    'distance', 'total_distance_meters',  50000),
  ('distance_100km',  '100km達成',  '累計100kmを歩いた',   'distance', 'total_distance_meters', 100000),
  ('distance_500km',  '500km達成',  '累計500kmを歩いた',   'distance', 'total_distance_meters', 500000),
  ('distance_1000km', '1000km達成', '累計1000kmを歩いた',  'distance', 'total_distance_meters',1000000),

  -- weather badges
  ('rain_walker',   '雨サンポスター',   '雨の日に散歩した',             'weather',     'walk_in_rain',        1),
  ('snow_walker',   '雪サンポスター',   '雪の日に散歩した',             'weather',     'walk_in_snow',        1),
  ('rain_5times',   '雨でも5回',       '雨の日に5回散歩した',           'weather',     'walk_in_rain',        5),

  -- time of day badges
  ('midnight_walker',  '深夜サンポスター',   '深夜(0〜5時)に散歩した',     'time_of_day', 'walk_at_midnight',    1),
  ('morning_walker',   '早朝サンポスター',   '早朝(5〜10時)に散歩した',    'time_of_day', 'walk_in_morning',     1),
  ('night_owl_5',      '夜サンポスター5回', '夜(20時以降)に5回散歩した',  'time_of_day', 'walk_at_night',       5),

  -- community badges
  ('first_post',       '初投稿',           'コースを初めて投稿した',          'community', 'course_post_count',   1),
  ('nice_received_10', 'ナイス10獲得',     'ナイスサンポ！を10回もらった',    'community', 'nice_received',      10),
  ('nice_received_100','ナイス100獲得',    'ナイスサンポ！を100回もらった',   'community', 'nice_received',     100),
  ('first_favorite',   '初お気に入り',     '初めてお気に入り登録された',       'community', 'favorite_received',   1),

  -- course badges
  ('course_walker_3',  '3コース踏破',   '3種類のコースを歩いた',           'course', 'unique_courses_walked',  3),
  ('course_walker_10', '10コース踏破',  '10種類のコースを歩いた',          'course', 'unique_courses_walked', 10),

  -- special / secret
  ('all_weather',      '天気コレクター',  '全天候で散歩した（晴・曇・雨・雪・霧・風）',  'special',  'all_weather_types',  null),
  ('all_time_of_day',  '時間帯コレクター','全時間帯で散歩した',                          'special',  'all_time_categories', null);
