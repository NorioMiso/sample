-- =============================================================
-- Security Advisor: Function Search Path Mutable (7 warnings)
-- 全関数に SET search_path = '' を追加し、テーブル参照を完全修飾に変更
-- =============================================================

-- set_updated_at
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  new.updated_at := now();
  RETURN new;
END;
$$;

-- auth_uid
CREATE OR REPLACE FUNCTION auth_uid()
RETURNS uuid LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT auth.uid()
$$;

-- my_user_id
CREATE OR REPLACE FUNCTION my_user_id()
RETURNS uuid LANGUAGE sql STABLE
SET search_path = ''
AS $$
  SELECT id FROM public.users WHERE auth_id = auth.uid()
$$;

-- set_age_group
CREATE OR REPLACE FUNCTION set_age_group()
RETURNS trigger LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  current_year int := EXTRACT(year FROM now())::int;
  age int;
BEGIN
  IF new.birth_year IS NULL THEN
    new.age_group := 'unknown';
  ELSE
    age := current_year - new.birth_year;
    new.age_group := CASE
      WHEN age < 20 THEN 'teens'
      WHEN age < 30 THEN '20s'
      WHEN age < 40 THEN '30s'
      WHEN age < 50 THEN '40s'
      WHEN age < 60 THEN '50s'
      ELSE '60+'
    END;
  END IF;
  RETURN new;
END;
$$;

-- set_walk_record_computed
CREATE OR REPLACE FUNCTION set_walk_record_computed()
RETURNS trigger LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  jst timestamp;
BEGIN
  jst := (new.started_at AT TIME ZONE 'UTC') + interval '9 hours';
  new.duration_seconds := EXTRACT(epoch FROM (new.ended_at - new.started_at))::int;
  new.walked_date      := jst::date;
  new.day_of_week      := EXTRACT(dow FROM jst)::int;
  new.month            := EXTRACT(month FROM jst)::int;
  new.year             := EXTRACT(year FROM jst)::int;
  RETURN new;
END;
$$;

-- update_nice_count
CREATE OR REPLACE FUNCTION update_nice_count()
RETURNS trigger LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.course_posts SET nice_count = nice_count + 1 WHERE id = new.course_post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.course_posts SET nice_count = GREATEST(nice_count - 1, 0) WHERE id = old.course_post_id;
  END IF;
  RETURN null;
END;
$$;

-- update_walked_count
CREATE OR REPLACE FUNCTION update_walked_count()
RETURNS trigger LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.course_posts SET walked_count = walked_count + 1 WHERE id = new.course_post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.course_posts SET walked_count = GREATEST(walked_count - 1, 0) WHERE id = old.course_post_id;
  END IF;
  RETURN null;
END;
$$;

-- update_comment_count
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS trigger LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE public.course_posts SET comment_count = comment_count + 1 WHERE id = new.course_post_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE public.course_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = old.course_post_id;
  END IF;
  RETURN null;
END;
$$;
