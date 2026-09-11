# bmcbadsys

バドミントンクラブ運営費管理システム。React 19 / TypeScript / Vite 6 / Tailwind CSS v4(CSS-first、`tailwind.config.*`なし。`src/index.css`の`@theme`で完結) / Firebase(Auth + Firestore)。

- UIは全て日本語。応答も日本語で行う。
- 既存の機能・仕様・データ構造を優先する。指示されていない変更・リファクタリング・分割はしない。
- ファイルサイズが大きいこと自体は問題ではない。全文を読まず、必要な箇所だけRead/Grepする。

## Git運用(最重要)

**このサンドボックスからGitHubへ直接`git push`できない**(プロキシの許可リポジトリ外)。連携先のユーザーPC(`device_bash`)からも同様に不可(隔離VM、github.comへの経路なし)。

代わりに以下のbundle運用を使う:

1. 変更をこのリポジトリでcommitする。
2. `git bundle create <path>.bundle --all` で作成し `git bundle verify` で検証する。
   (`/mnt/user-data/outputs/`への直接書き込みが`Bad file descriptor`で失敗することがある。その場合はスクラッチディレクトリに作成してから`cp`する。)
3. `SendUserFile`で送り、`device_commit_files`で `~/bmcbadsys/.claude-update.bundle` に書き込む(`force: true`)。
4. ユーザーが`~/bmcbadsys/apply_update.bat`を実行すると fetch → merge → push が自動で走る。

`apply_update.bat`はShift-JIS(CP932)で保存すること(UTF-8だと日本語がmojibakeする)。stop-hookが「unpushed commits」を報告するのは通常、ユーザーがまだ`apply_update.bat`を実行していないだけ。

## ビルド・検証

この環境では`npm install`/`bun install`がレジストリ403で失敗し、実ビルド・実描画確認ができない。代わりに:

- 変更した`.tsx`/`.css`の括弧・波括弧バランスをnode等で確認。
- スクラッチディレクトリで`tsc --noEmit --jsx react-jsx --esModuleInterop --skipLibCheck --moduleResolution bundler --module esnext --target es2020`を実行し、構文エラー(TS1xxx)のみチェック。
- 新規の配色は相対輝度からWCAGコントラスト比を手計算して確認する。

## 触ってはいけない箇所

`src/index.css`のモバイル用メディアクエリ内、`input`/`select`/`textarea`の`font-size: 16px !important`。iOS Safariの自動ズームを防ぐための必須ルール。

## テーマシステム

`data-theme`属性と`theme-<値>`クラスの両方が`<html>`/`<body>`に付与される二重方式。default/clean_lightはCSS変数トークン(`--color-*`)で駆動するが、pixel/pixel_lightはトークンを使わずクラス単位の`!important`上書きで駆動する(非対称な設計)。配色の詳細やコントラスト値は都度`src/index.css`を直接確認する。

## コミット

コミットメッセージ末尾に以下を付与する(セッションのシステムリマインダーに記載の値を使用):

```
Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
Claude-Session: <session URL>
```
