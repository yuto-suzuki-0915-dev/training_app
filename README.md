# LOGBOOK — 筋トレ記録アプリ

スマートフォンのブラウザーで、種目とセットを素早く記録するNext.jsアプリです。MVPの範囲と完成条件は [MVP_PLAN.md](./MVP_PLAN.md) を参照してください。

## 実装済みの機能

- メールアドレスとパスワードによる登録・ログイン・ログアウト
- トレーニングの開始、再開、中止、終了（進行中は1件）
- 初期登録された種目の検索・追加、前回記録の表示
- セットの保存・編集・削除、保存失敗時の入力保持と再試行
- 終了済みトレーニングの一覧と詳細
- ユーザー別のアクセス制御を定義したDB migration

## 開発環境

- Node.js / npm
- Supabaseプロジェクト（認証とPostgreSQL）

```bash
npm install
npm run dev
```

Supabaseの接続情報がない間は、画面にセットアップ案内を表示します。`npm run build`、`npm run lint`、`npx tsc --noEmit` は接続情報なしでも実行できます。

## Supabaseの設定

1. Supabaseプロジェクトを作成する。
2. [migration](./supabase/migrations/20260928000100_create_workout_schema.sql) をSupabase CLIの `db push` で適用する。テーブル、初期種目、制約、RLSが作られます。このSQLは新規プロジェクト用です。
3. Supabase Dashboardの **Authentication → Sign In / Providers → Email** でメール認証と新規登録を有効にし、MVPの試用中は **Confirm emailをオフ**にする。これにより登録後すぐにログインできます。メール所有者の確認は行われないため、公開運用前に認証方針を見直してください。
4. `.env.example` をコピーして `.env.local` を作り、Project URLとpublishable keyを設定する。`service_role` keyは使用しません。
5. 開発サーバーを再起動する。

```text
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

`.env.local` はGitに含めないでください。確認メールを使わない登録・ログインにはSMTP設定は不要です。パスワード再設定は現時点で実装していません。

## 接続後の確認

1. メールアドレスとパスワードで登録し、ログアウト後に再ログインできることを確認する。その後トレーニングを開始する。開始ボタンを続けて押しても進行中セッションは1件だけになる。
2. 種目を追加し、`80kg × 8回` を3セット記録する。ページを再読込し、3セットと進行中セッションが復元される。
3. セットを修正・削除し、再度記録できる。ネットワークを遮断して保存すると失敗が表示され、入力が残る。
4. 終了して履歴詳細を確認する。翌日も同じ記録を確認でき、次のトレーニングで前回記録として表示される。
5. 別のユーザーでログインし、最初のユーザーの記録を取得・変更できないことを確認する。

## 構成

```text
src/app/           経路と画面
src/components/    Web UIと認証状態
src/domain/        環境に依存しない型・入力検証
src/data/          Supabaseへの保存・取得
src/lib/supabase/  ブラウザー用client
supabase/          DB migrationと開発用seed
```

現段階はブラウザーclientとRLSを利用します。migrationはSupabaseプロジェクトに適用済みです。登録・ログインと記録の一連の操作は実アカウントで確認してください。
