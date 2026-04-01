-- user_badges に認証済みユーザーが自分のバッジを登録できるよう RLS ポリシーを追加
-- （バッジ付与の条件チェックはアプリ側 src/lib/badges.ts で実施）
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_badges: own insert" ON user_badges;
CREATE POLICY "user_badges: own insert" ON user_badges
  FOR INSERT TO authenticated
  WITH CHECK (user_id = my_user_id());
