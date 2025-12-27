# Implementation Task: Cloudflare R2 Image Upload Feature

あなたは Next.js (App Router), TypeScript, Cloudflare R2 のエキスパートです。
以下の要件とコンテキストに基づき、画像アップロード機能を実装してください。

## 1. 前提コンテキスト (Context)
* **Project:** Media Interview Platform
* **Storage:** Cloudflare R2 (AWS SDK v3互換)
* **Env Vars:** `.env.local` に以下の変数が設定済みです。
    * `R2_ACCOUNT_ID`: (Cloudflare Account ID)
    * `R2_ACCESS_KEY_ID`: (R2 API Token Access Key)
    * `R2_SECRET_ACCESS_KEY`: (R2 API Token Secret Key)
    * `R2_BUCKET_NAME`: `bankisha-times`
    * `NEXT_PUBLIC_R2_DOMAIN`: `https://pub-8aa83ae527054eb9ad205eb019cbd8da.r2.dev`

## 2. 実装タスク (Tasks)

以下の順序でコードを作成・修正してください。

### Step 1: パッケージのインストール
以下のパッケージを使用します。インストールコマンドを提示してください。
* `@aws-sdk/client-s3`
* `@aws-sdk/s3-request-presigner`
* `uuid` (および `@types/uuid`)

### Step 2: R2クライアントの初期化 (`lib/r2.ts`)
* `S3Client` を初期化してエクスポートしてください。
* **Endpoint:** `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
* **Region:** `auto`
* **Credentials:** 環境変数の Access Key と Secret Key を使用。

### Step 3: 署名付きURL発行API (`app/api/upload/route.ts`)
* **Method:** `POST`
* **Request Body:** `{ filename: string, contentType: string }`
* **Logic:**
    1. `uuid` を使用して、ユニークなファイル名 (Key) を生成します (例: `uploads/${uuid}-${filename}`)。
    2. `PutObjectCommand` を作成します。
    3. `getSignedUrl` を使用して、署名付きURL (Presigned URL) を発行します (有効期限: 300秒)。
* **Response:** `{ url: string, key: string }` (urlは署名付きURL、keyは保存したファイルパス)

### Step 4: アップロードUIコンポーネント (`components/MediaImageUploader.tsx`)
* **Directive:** `use client`
* **UI:**
    * `<input type="file" accept="image/*" />`
    * アップロードボタン (選択中のみ活性化、アップロード中は無効化)
    * プレビュー領域 (アップロード完了後に画像を表示)
* **Action:**
    1. ユーザーがファイルを選択しボタンを押す。
    2. `/api/upload` を叩いて、署名付きURLとKeyを取得する。
    3. 取得した署名付きURLに対して、**ブラウザから直接** `PUT` リクエストでファイルを送信する。
        * `Content-Type` ヘッダーを正しく設定すること。
    4. 成功したら、画像の公開URL (`${process.env.NEXT_PUBLIC_R2_DOMAIN}/${key}`) を作成してプレビュー表示する。

## 3. 出力要件
* 各ファイルの完全なコードを提示してください。
* `components/MediaImageUploader.tsx` は、Tailwind CSS を使用して見やすいUIにしてください。