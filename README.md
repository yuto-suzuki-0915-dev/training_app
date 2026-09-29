# LOGBOOK — 筋トレ記録アプリ

スマートフォンのブラウザーで、種目とセットを素早く記録するNext.jsアプリです。MVPの範囲と完成条件は [MVP_PLAN.md](./MVP_PLAN.md) を参照してください。

## 実装済みの機能

- メールアドレスとパスワードによる登録・ログイン・ログアウト
- トレーニングの開始、再開、中止、終了（進行中は1件）
- 初期登録された種目の検索・追加、前回記録の表示
- セットの保存・編集・削除、保存失敗時の入力保持と再試行
- 終了済みトレーニングの一覧と詳細
- ホームの月間カレンダーと今日のトレーニングサマリー
- 部位別の種目メニュー、種目ごとの実測最大重量と推定RM表示
- ユーザー別のアクセス制御を定義したDB migration

ホームは下部タブの中央です。カレンダーは、端末のローカル日付でトレーニングを開始した日を「完了済み」として表示します。同じ日に複数回記録しても印は1つです。最大重量は本人の完了済み・進行中のセットから求め、中止した記録は含めません。RMは記録した重量・回数から推定した目安で、実測の限界回数ではありません。推定1RMの基準には1〜10回の正の重量のセットを使い、基準を作れない場合は推定値を表示しません。

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
6. ホームで今日の記録と今月の印を確認する。部位から種目を追加し、セット保存後に最大重量と推定RMが更新されることを確認する。

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
