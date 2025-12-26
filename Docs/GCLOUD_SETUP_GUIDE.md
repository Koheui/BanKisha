# Google Cloud SDK (gcloud) セットアップガイド

デプロイスクリプト実行時に `gcloud: command not found` と表示されるのは、お使いの Mac に Google Cloud SDK がインストールされていない、またはパスが通っていないことが原因です。

以下の手順でセットアップをお願いします。

## 1. Google Cloud SDK のインストール

### Homebrew をお使いの場合（推奨）
ターミナルで以下のコマンドを実行してください。
```bash
brew install --cask google-cloud-sdk
```

### 直接ダウンロードする場合
1. [Google Cloud SDK 公式サイト](https://cloud.google.com/sdk/docs/install?hl=ja#mac) から macOS 用のアーカイブをダウンロードします。
2. 解凍して、適当な場所（例：`/Users/koheioka/google-cloud-sdk`）に配置します。
3. インストールスクリプトを実行します。
```bash
./google-cloud-sdk/install.sh
```

## 2. 初期設定
インストール完了後、新しいターミナルを開き、以下のコマンドを順番に実行してログインとプロジェクトの設定を行います。

### ログイン
ブラウザが起動するので、Firebase プロジェクト（`bankisha-654d0`）を管理している Google アカウントでログインしてください。
```bash
gcloud auth login
```

### プロジェクトの設定
```bash
gcloud config set project bankisha-654d0
```

### ADC（Application Default Credentials）の設定
（ローカルからの API 利用に必要になる場合があります）
```bash
gcloud auth application-default login
```

## 3. 再デプロイ
上記が完了しましたら、再度デプロイスクリプトを実行してください。
```bash
./deploy.sh
```

---
**補足**: パスが通っていない場合は、ターミナルを再起動するか、`.zshrc`（または `.bash_profile`）に SDK のパスを追記する必要があるかもしれません。Homebrew でインストールした場合は、通常自動的にパスが通ります。
