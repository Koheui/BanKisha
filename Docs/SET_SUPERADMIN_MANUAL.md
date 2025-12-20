# 🔴 スーパーアドミン設定マニュアル

## 問題
ログインしても普通のUIが表示される → Firestoreの`users`コレクションに`role: 'superAdmin'`が設定されていない

---

## ✅ 解決方法：Firebase Consoleで直接設定

### ステップ1: Firebase Consoleにアクセス

1. ブラウザで以下のURLを開く：
```
https://console.firebase.google.com/project/bankisha-654d0/firestore
```

2. Googleアカウントでログイン

---

### ステップ2: ユーザーのUIDを取得

1. **Authentication**タブに移動
```
https://console.firebase.google.com/project/bankisha-654d0/authentication/users
```

2. `office@futurestudio.co.jp` を探す

3. **ユーザーUID**をコピー（例: `abc123def456...`）

---

### ステップ3: Firestoreでroleを設定

1. **Firestore Database**タブに移動
```
https://console.firebase.google.com/project/bankisha-654d0/firestore
```

2. `users`コレクションを開く

3. 該当するユーザーのドキュメント（UID）を探す
   - もし存在しない場合：**ドキュメントを作成**
   - ドキュメントID = ユーザーのUID

4. 以下のフィールドを設定：

```
email: "office@futurestudio.co.jp"
role: "superAdmin"
displayName: "Super Admin"  (任意)
createdAt: (Timestamp) 現在時刻
updatedAt: (Timestamp) 現在時刻
```

5. **保存**をクリック

---

### ステップ4: ログアウト→ログイン

1. アプリでログアウト

2. 再度ログイン
   - Email: `office@futurestudio.co.jp`
   - Password: `12345678`

3. ダッシュボードを確認

---

## 🎯 確認ポイント

ログイン後、以下が表示されるはずです：

### ヘッダー
- 🔴 赤いバッジ「**Super Admin**」

### ダッシュボード
- 🔴 **Super Admin専用機能**セクション（赤い点が脈打つ）
  - アプリの方向性（赤いカード）
  - スキルナレッジベース（赤いカード）
  - 情報ナレッジベース（赤いカード）

---

## 🖼️ スクリーンショット例

### Before（普通のユーザー）
```
ダッシュボード
user@example.com としてログイン中

ユーザー機能
- ユーザーナレッジベース
- インタビュアー設定
- 新規インタビュー作成
```

### After（スーパーアドミン）
```
ダッシュボード
office@futurestudio.co.jp としてログイン中  [🔴 Super Admin]

🔴 Super Admin専用機能  ← 赤い点が脈打つ
- [赤いカード] アプリの方向性
- [赤いカード] スキルナレッジベース
- [赤いカード] 情報ナレッジベース

ユーザー機能
- ユーザーナレッジベース
- インタビュアー設定
- 新規インタビュー作成
```

---

## 🔧 トラブルシューティング

### Q: ユーザーが見つからない
**A**: Firebase Console > Authentication でユーザーを作成してください

### Q: Firestoreにusersコレクションがない
**A**: 手動で作成してください
1. Firestore Database > コレクションを開始
2. コレクションID: `users`
3. ドキュメントID: ユーザーのUID
4. フィールドを追加

### Q: 設定したのに反映されない
**A**: 以下を試してください
1. ログアウト→ログイン
2. ブラウザのキャッシュをクリア（Cmd+Shift+R）
3. シークレットウィンドウで試す

---

## 📋 Firestoreドキュメントの例

```json
users/{ユーザーのUID}
{
  "email": "office@futurestudio.co.jp",
  "role": "superAdmin",
  "displayName": "Super Admin",
  "createdAt": Timestamp(2025, 12, 15, 10, 0, 0),
  "updatedAt": Timestamp(2025, 12, 15, 10, 0, 0)
}
```

**重要**: `role`フィールドの値は**必ず**`"superAdmin"`（文字列）にしてください。

---

## ✅ 完了確認

設定後、以下を確認：
1. ✅ ヘッダーに赤いバッジ「Super Admin」が表示される
2. ✅ ダッシュボードに「🔴 Super Admin専用機能」セクションが表示される
3. ✅ 3つの赤いカードが表示される
4. ✅ `/admin/app-direction`、`/admin/skill-kb`、`/admin/info-kb`にアクセスできる

---

## 🚀 次のステップ

スーパーアドミン設定が完了したら：
1. アプリの方向性プロンプトを設定
2. スキルKBをアップロード
3. 情報KBをアップロード

Happy Coding! 🎉


