-- =============================================================
-- Supabase Storage バケット設定
-- Supabase ダッシュボード > Storage で実行するか、
-- supabase/seed.sql に含めて実行してください
-- =============================================================

-- ユーザーアイコン（公開）
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- コース写真（公開）
insert into storage.buckets (id, name, public)
values ('course-photos', 'course-photos', true)
on conflict (id) do nothing;

-- コメント写真（公開）
insert into storage.buckets (id, name, public)
values ('comment-photos', 'comment-photos', true)
on conflict (id) do nothing;

-- =============================================================
-- Storage RLSポリシー
-- =============================================================

-- avatars: 誰でも読める / 本人のみアップロード
create policy "avatars: public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "avatars: auth upload"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "avatars: own delete"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- course-photos: 誰でも読める / 認証済みユーザーがアップロード
create policy "course-photos: public read"
  on storage.objects for select
  using (bucket_id = 'course-photos');

create policy "course-photos: auth upload"
  on storage.objects for insert
  with check (
    bucket_id = 'course-photos'
    and auth.role() = 'authenticated'
  );

create policy "course-photos: own delete"
  on storage.objects for delete
  using (
    bucket_id = 'course-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- comment-photos: 誰でも読める / 認証済みユーザーがアップロード
create policy "comment-photos: public read"
  on storage.objects for select
  using (bucket_id = 'comment-photos');

create policy "comment-photos: auth upload"
  on storage.objects for insert
  with check (
    bucket_id = 'comment-photos'
    and auth.role() = 'authenticated'
  );
