2026-09-09 11:20 変更済み

アップロード先：GitHub の fukurinrou-reserve

このフォルダの中にある src / public / schema.sql を、
fukurinrou-reserve リポジトリの一番上へ上書きアップロードしてください。

この更新により、管理画面「サイト編集」→「席・コース予約」で保存した
コース名・料金・料理内容・飲み放題料金・案内文を、お客様用予約ページへ表示できます。

先に Cloudflare D1 の fukurinrou-osechi-db で
「D1_初回設定_席コース管理.sql」を一度だけ実行してください。

アップロード後、Cloudflare のビルドが緑のチェックになれば完了です。
