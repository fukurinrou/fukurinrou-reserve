2026-09-09 10:45 変更済み

福林楼 席・コース予約サイト
メールデザイン・キャンセル画面修正版

1. このZIPを解凍します。
2. GitHubの fukurinrou-reserve を開きます。
3. 解凍した public フォルダ内の index.html と cancel.html を、GitHub上の public フォルダへアップロードして置き換えます。
4. Commit changes を押します。
5. Cloudflare Workers のデプロイ完了後、予約ページを開き直します。

続けて、EmailJSメール設定_上品版.txt の内容を使い、下記の既存テンプレートを更新します。

・Auto-Reply：お客様向け
・Contact Us：店舗向け

設定後は、予約を1件テスト送信し、続けてキャンセルして確認してください。
