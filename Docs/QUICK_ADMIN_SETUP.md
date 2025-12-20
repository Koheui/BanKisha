# 管理者ユーザー作成（簡単な方法）

## ステップ1: Firebase Consoleでユーザーを作成

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクト `bankisha-654d0` を選択
3. 左メニューから「Authentication」をクリック
4. 「ユーザー」タブをクリック
5. 「ユーザーを追加」をクリック
6. 以下の情報を入力：
   - **メール**: `office@futurestudio.co.jp`
   - **パスワード**: `12345678`
7. 「追加」をクリック
8. 作成されたユーザーの**UID**をコピー（後で使用します）

## ステップ2: Firestoreで管理者ロールを設定

1. Firebase Console > Firestore Database に移動
2. `users` コレクションを開く
3. ステップ1でコピーした**UID**でドキュメントを作成（または既存のドキュメントを更新）
4. 以下のフィールドを設定：

```json
{
  "uid": "ステップ1でコピーしたUID",
  "email": "office@futurestudio.co.jp",
  "displayName": "管理者",
  "role": "admin",
  "companyId": null,
  "createdAt": "現在のタイムスタンプ（Firestoreのタイムスタンプ）",
  "updatedAt": "現在のタイムスタンプ（Firestoreのタイムスタンプ）"
}
```

**重要**: `role`フィールドを`"admin"`に設定してください。

## ステップ3: ログイン確認

1. http://localhost:3000/login にアクセス
2. メールアドレス: `office@futurestudio.co.jp`
3. パスワード: `12345678`
4. ログイン後、ダッシュボードに「ナレッジベース管理」ボタンが表示されれば成功です！

## トラブルシューティング

### ログインできない場合
- メールアドレスとパスワードが正しいか確認
- Firebase Console > Authentication > ユーザーでユーザーが作成されているか確認

### 管理者機能が表示されない場合
- Firestore > users > [UID] で`role`フィールドが`"admin"`になっているか確認
- ブラウザをリロード（Ctrl+R / Cmd+R）


