# sanpostar — DB設計ドキュメント

## テーブル一覧

| テーブル名              | 役割                                       |
|----------------------|--------------------------------------------|
| `users`              | ユーザープロフィール（nickname・icon・生年） |
| `walk_records`       | 散歩記録（距離・時間・天気・公開設定）       |
| `walk_routes`        | GPSルートデータ（PostGIS LineString）       |
| `walk_stats`         | ユーザー統計集計（トリガーで自動更新）       |
| `course_posts`       | 共有コース投稿（地図＋写真＋コメント）       |
| `course_photos`      | コース投稿の添付写真                         |
| `nice_sanpos`        | ナイスサンポ！（いいね相当）                 |
| `course_walks`       | コースを歩いたユーザーの記録                 |
| `course_comments`    | コースへのコメント（ネスト返信対応）         |
| `favorite_sanposters`| お気に入りサンポスター登録（フォロー）       |
| `praises`            | AI生成の称え（毎日通知・パーソナルベスト）   |
| `badges`             | バッジ定義（シードデータ）                   |
| `user_badges`        | ユーザーが獲得したバッジ                     |
| `notifications`      | 通知ログ                                     |

---

## ER図（概要）

```
auth.users
    │
    └── users ──────────────────────────────────────────────┐
          │                                                  │
          ├── walk_records ──── walk_routes                  │
          │       │                                          │
          │       └── (AI称え生成の入力)                      │
          │                                                  │
          ├── walk_stats  (aggregate)                        │
          │                                                  │
          ├── course_posts ─── course_photos                 │
          │       │                                          │
          │       ├── nice_sanpos ◄─────── users             │
          │       ├── course_walks ◄────── users             │
          │       └── course_comments ◄── users              │
          │                                                  │
          ├── favorite_sanposters ◄──────────────────────────┘
          │
          ├── praises
          ├── user_badges ── badges
          └── notifications
```

---

## 主要テーブル詳細

### `walk_records` — 散歩記録の中核

ランキング集計に使う属性を**生成列（generated column）でdenormalize**しておくことで、
「雨の深夜×30代」などの複合条件クエリを高速化しています。

| カラム           | 型                      | 説明                              |
|-----------------|-------------------------|-----------------------------------|
| `distance_meters`| int                   | 歩行距離（メートル）               |
| `time_of_day`   | enum                    | morning/daytime/evening/night/midnight |
| `weather`       | enum                    | sunny/cloudy/rainy/snowy/foggy/windy |
| `walked_date`   | date (generated)        | 散歩日（JST）                     |
| `day_of_week`   | int (generated)         | 曜日 0=日〜6=土                   |
| `month` / `year`| int (generated)         | 月・年                            |

### `users.age_group` — 生成列

`birth_year` から自動計算される `age_group`（teens/20s/30s/40s/50s/60+）を
生成列として保持し、称えのランキング条件に使用します。

### `praises` — AI称えの保存

```jsonc
// ranking_conditions の例
{
  "weather": "rainy",
  "time_of_day": "midnight",
  "age_group": "30s",
  "day_of_week": 4,   // 木曜日
  "year": 2025,
  "month": 11
}
```

Claude APIはこの条件でフィルタしたウォーキングデータをもとに
`rank` / `total_count` を算出し、称え文を生成します。

### `badges` — バッジ定義（シードデータ）

全22種のバッジを初期投入済み。カテゴリ別：

| カテゴリ     | バッジ例                              |
|------------|--------------------------------------|
| streak     | 3日・10日・30日・100日連続             |
| distance   | 10km・50km・100km・500km・1000km累計  |
| weather    | 雨サンポスター・雪サンポスター          |
| time_of_day| 深夜サンポスター・早朝サンポスター      |
| community  | 初投稿・ナイス10/100獲得              |
| course     | 3/10コース踏破                        |
| special    | 全天候コレクター・全時間帯コレクター    |

---

## RLS（Row Level Security）方針

| テーブル          | 一般ユーザー             | 本人         |
|-----------------|--------------------------|--------------|
| walk_records    | is_public=true のみ読取  | 全操作可      |
| praises         | 参照不可                 | 全操作可      |
| course_posts    | is_public=true のみ読取  | 全操作可      |
| notifications   | 参照不可                 | 全操作可      |
| badges          | 読取可                   | —            |
| user_badges     | 読取可（プロフィール表示）| —            |

---

## 称えランキング用クエリのイメージ

```sql
-- 「雨の深夜に歩いた距離」ランキング（今月）
select
  u.id,
  u.nickname,
  u.age_group,
  sum(wr.distance_meters) as total_distance,
  rank() over (order by sum(wr.distance_meters) desc) as rank
from walk_records wr
join users u on u.id = wr.user_id
where wr.is_public = true
  and wr.weather = 'rainy'
  and wr.time_of_day = 'midnight'
  and wr.year = 2025
  and wr.month = 11
group by u.id, u.nickname, u.age_group
order by rank;
```
