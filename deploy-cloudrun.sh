#!/bin/bash

# .env.localから環境変数を読み込む
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
fi

echo "🔨 ビルドを開始します（環境変数をビルド時に埋め込み）..."

# cloudbuild.yamlを使用してビルド（環境変数をsubstitutionsで渡す）
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}",_NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}",_NEXT_PUBLIC_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-bankisha-654d0}",_NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}",_NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}",_NEXT_PUBLIC_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}",_NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL="${NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL}",_GEMINI_API_KEY="${GEMINI_API_KEY}"

if [ $? -ne 0 ]; then
  echo "❌ ビルドに失敗しました"
  exit 1
fi

echo "✅ デプロイ完了！"
