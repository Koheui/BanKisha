#!/bin/bash

# .env.localから環境変数を読み込む
if [ -f .env.local ]; then
  export $(cat .env.local | grep -v '^#' | grep -v '^$' | xargs)
fi

# Configuration
PROJECT_ID="bankisha-654d0"
IMAGE_NAME="gcr.io/${PROJECT_ID}/bankisha-app"

echo "🔨 ビルドを開始します（環境変数をビルド時に埋め込み）..."

# cloudbuild.yamlを使用してビルド（環境変数をsubstitutionsで渡す）
gcloud builds submit \
  --config cloudbuild.yaml \
  --substitutions=_IMAGE_NAME="${IMAGE_NAME}",_FIREBASE_API_KEY="${NEXT_PUBLIC_FIREBASE_API_KEY}",_FIREBASE_AUTH_DOMAIN="${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN}",_FIREBASE_PROJECT_ID="${NEXT_PUBLIC_FIREBASE_PROJECT_ID:-bankisha-654d0}",_FIREBASE_STORAGE_BUCKET="${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}",_FIREBASE_MESSAGING_SENDER_ID="${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID}",_FIREBASE_APP_ID="${NEXT_PUBLIC_FIREBASE_APP_ID}",_FIREBASE_FUNCTIONS_URL="${NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL}"

if [ $? -ne 0 ]; then
  echo "❌ ビルドに失敗しました"
  exit 1
fi

echo "✅ デプロイ完了！"
