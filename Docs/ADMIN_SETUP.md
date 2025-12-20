# 管理者ユーザー作成ガイド

## 方法1: スクリプトで自動作成（推奨）

### ステップ1: サービスアカウントキーを取得

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクト `bankisha-654d0` を選択
3. 左メニューの⚙️アイコン（プロジェクト設定）をクリック
4. 「サービスアカウント」タブをクリック
5. 「新しい秘密鍵の生成」をクリック
6. ダウンロードしたJSONファイルを `service-account-key.json` としてプロジェクトルートに配置

**重要**: `service-account-key.json` は `.gitignore` に含まれているため、Gitにコミットされません。

### ステップ2: スクリプトを実行

```bash
npm run create:admin
```

これで以下の管理者ユーザーが作成されます：
- **メールアドレス**: office@futurestudio.co.jp
- **パスワード**: 12345678
- **ロール**: admin

## 方法2: Firebase Consoleから手動作成

### ステップ1: ユーザーを作成

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクト `bankisha-654d0` を選択
3. 左メニューから「Authentication」をクリック
4. 「ユーザー」タブをクリック
5. 「ユーザーを追加」をクリック
6. 以下の情報を入力：
   - **メール**: office@futurestudio.co.jp
   - **パスワード**: 12345678
7. 「追加」をクリック

### ステップ2: Firestoreで管理者ロールを設定

1. Firebase Console > Firestore Database に移動
2. `users` コレクションを開く
3. 作成したユーザーのUIDでドキュメントを作成/更新：
   ```json
   {
     "uid": "ユーザーのUID",
     "email": "office@futurestudio.co.jp",
     "displayName": "管理者",
     "role": "admin",
     "companyId": null,
     "createdAt": "現在のタイムスタンプ",
     "updatedAt": "現在のタイムスタンプ"
   }
   ```

## ログイン確認

作成後、以下のURLでログインできます：
- http://localhost:3000/login
- メールアドレス: office@futurestudio.co.jp
- パスワード: 12345678

ログイン後、ダッシュボードに「ナレッジベース管理」ボタンが表示されれば成功です。


