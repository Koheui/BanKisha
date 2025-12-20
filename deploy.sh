#!/bin/bash

# Cloud Run デプロイスクリプト
# 使用方法: ./deploy.sh

set -e  # エラーが発生したら停止

echo "🚀 Cloud Run へのデプロイを開始します..."

# プロジェクトID
PROJECT_ID="bankisha-654d0"
REGION="asia-northeast1"
SERVICE_NAME="bankisha-app"
IMAGE_NAME="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

# 環境変数ファイルの確認
if [ ! -f .env.local ]; then
    echo "❌ エラー: .env.local ファイルが見つかりません"
    exit 1
fi

# 環境変数を読み込む
source .env.local

# 必要な環境変数の確認
REQUIRED_VARS=(
    "NEXT_PUBLIC_FIREBASE_API_KEY"
    "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN"
    "NEXT_PUBLIC_FIREBASE_PROJECT_ID"
    "NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET"
    "NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID"
    "NEXT_PUBLIC_FIREBASE_APP_ID"
    "GEMINI_API_KEY"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo "❌ エラー: 環境変数 $var が設定されていません"
        exit 1
    fi
done

echo "✅ 環境変数の確認完了"

# gcloud のログイン確認
echo "🔐 gcloud の認証状態を確認..."
if ! gcloud auth list --filter=status:ACTIVE --format="value(account)" | grep -q .; then
    echo "⚠️  gcloud にログインしていません。ログインしてください:"
    echo "   gcloud auth login"
    exit 1
fi

# プロジェクトの設定確認
CURRENT_PROJECT=$(gcloud config get-value project 2>/dev/null || echo "")
if [ "$CURRENT_PROJECT" != "$PROJECT_ID" ]; then
    echo "📝 プロジェクトを設定: $PROJECT_ID"
    gcloud config set project "$PROJECT_ID"
fi

# 必要なAPIの有効化確認
echo "🔧 必要なAPIが有効か確認..."
gcloud services enable cloudbuild.googleapis.com --quiet || true
gcloud services enable run.googleapis.com --quiet || true
gcloud services enable containerregistry.googleapis.com --quiet || true

# Dockerイメージのビルドとプッシュ
echo "🏗️  DockerイメージをビルドしてGCRにプッシュ..."
gcloud builds submit --tag "$IMAGE_NAME" || {
    echo "❌ ビルドに失敗しました"
    exit 1
}

echo "✅ ビルド完了"

# Cloud Runにデプロイ
echo "🚀 Cloud Runにデプロイ..."
gcloud run deploy "$SERVICE_NAME" \
    --image "$IMAGE_NAME" \
    --platform managed \
    --region "$REGION" \
    --allow-unauthenticated \
    --set-env-vars="NEXT_PUBLIC_FIREBASE_API_KEY=${NEXT_PUBLIC_FIREBASE_API_KEY},NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN},NEXT_PUBLIC_FIREBASE_PROJECT_ID=${NEXT_PUBLIC_FIREBASE_PROJECT_ID},NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET},NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID},NEXT_PUBLIC_FIREBASE_APP_ID=${NEXT_PUBLIC_FIREBASE_APP_ID},NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=${NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL},GEMINI_API_KEY=${GEMINI_API_KEY}" || {
    echo "❌ デプロイに失敗しました"
    exit 1
}

# デプロイURLの取得
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format 'value(status.url)')

echo ""
echo "✅ デプロイ完了！"
echo "🌐 サービスURL: $SERVICE_URL"
echo ""
echo "📋 次のステップ:"
echo "   1. ブラウザで $SERVICE_URL にアクセス"
echo "   2. アプリの動作を確認"
echo "   3. Firebase Hostingの設定を確認（必要に応じて）"
echo ""

