-- =============================================================
-- Supabase security advisor: rls_disabled_in_public
-- すべての public テーブルで RLS を有効化（冪等）
-- =============================================================

-- すでに有効な場合は何もしない（ALTER TABLE ... ENABLE ROW LEVEL SECURITY は冪等）
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_records         ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_routes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE walk_stats           ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_posts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_photos        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nice_sanpos          ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_walks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_sanposters  ENABLE ROW LEVEL SECURITY;
ALTER TABLE praises              ENABLE ROW LEVEL SECURITY;
ALTER TABLE badges               ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges          ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- 不足しているポリシーを追加（IF NOT EXISTS で冪等）
-- =============================================================

-- walk_stats: 管理者クライアントからの upsert を許可
-- （service_role は RLS をバイパスするので既存ポリシーのままで OK）

-- notifications: service_role からの INSERT を許可するポリシーは不要
-- （createAdminClient = service_role は RLS バイパス）

-- praises: service_role からの INSERT を許可（RLS バイパスのため不要だが明示）
-- 既存: "praises: owner all" — ユーザーは自分の称えを読める
-- service_role は RLS バイパスするので追加ポリシー不要

-- =============================================================
-- walk_stats: anon/authenticated ロールの直接アクセスを確実にブロック
-- =============================================================

-- 既存ポリシーが "for all" のため SELECT も含む。
-- anon（未ログイン）からの読み取りも防ぐため "using (user_id = my_user_id())" が正しい。
-- 00001 で作成済みなので追加不要。

-- =============================================================
-- badges / user_badges: service_role の INSERT のみ許可
-- （バッジ付与は checkAndAwardBadges 経由で service_role が行う）
-- =============================================================

-- user_badges への service_role INSERT は RLS バイパスで既に動作している。
-- anon が INSERT できないよう確認（"user_badges: own insert" ポリシーで authenticated のみ許可済み）。
