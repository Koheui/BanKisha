#!/bin/bash
# superAdmin設定スクリプト（Firebase CLI使用）

EMAIL="office@futurestudio.co.jp"
PASSWORD="12345678"

echo "superAdminユーザーを設定中..."

# Firebase CLIでログイン確認
if ! firebase projects:list &>/dev/null; then
  echo "Firebase CLIにログインしてください: firebase login"
  exit 1
fi

# ユーザーが存在するか確認（Firebase Consoleから手動で確認が必要）
echo "以下の手順でsuperAdminを設定してください:"
echo ""
echo "1. Firebase Consoleにアクセス: https://console.firebase.google.com/project/bankisha-654d0"
echo "2. Authentication > ユーザー でユーザーを作成（存在しない場合）"
echo "   - メールアドレス: $EMAIL"
echo "   - パスワード: $PASSWORD"
echo "3. Firestore Database > データ > users コレクション"
echo "4. 該当ユーザーのドキュメントを開く"
echo "5. role フィールドを 'superAdmin' に変更"
echo "6. 保存"
echo ""
echo "または、以下のコマンドでFirestoreを直接更新:"
echo "firebase firestore:update users/<USER_UID> --data '{\"role\":\"superAdmin\"}'"
