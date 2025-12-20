# Gemini 2.5 Flash Native Audio 音声サンプル

## 利用可能な音声タイプ

BanKishaアプリでは、Gemini 2.5 Flash Native Audioの以下の音声タイプを使用できます。

### 1. Puck（パック）
- **特徴**: 中性的で明るい声
- **おすすめ用途**: 
  - カジュアルなインタビュー
  - 親しみやすい対話
  - 若年層向けコンテンツ
- **API設定**: `voiceType: 'Puck'`

### 2. Charon（カロン）
- **特徴**: 落ち着いた低めの声
- **おすすめ用途**: 
  - フォーマルなインタビュー
  - ビジネス向けコンテンツ
  - 専門的な内容
- **API設定**: `voiceType: 'Charon'`

### 3. Kore（コレ）
- **特徴**: 柔らかく優しい声
- **おすすめ用途**: 
  - 感情的な話題
  - カウンセリング的なアプローチ
  - ライフスタイル系コンテンツ
- **API設定**: `voiceType: 'Kore'`

### 4. Fenrir（フェンリル）
- **特徴**: 力強く深みのある声
- **おすすめ用途**: 
  - 権威性が必要なインタビュー
  - ニュース・報道系
  - シリアスなテーマ
- **API設定**: `voiceType: 'Fenrir'`

### 5. Aoede（アオイデ）
- **特徴**: 穏やかで心地よい声
- **おすすめ用途**: 
  - リラックスした雰囲気
  - 教育系コンテンツ
  - 長時間の対話
- **API設定**: `voiceType: 'Aoede'`

## 実装方法

### インタビュアープロファイルで設定

```typescript
const interviewerProfile = {
  name: "田中太郎",
  role: "ジャーナリスト",
  voiceSettings: {
    voiceType: 'Charon' // 落ち着いた声を選択
  }
}
```

### Gemini API での使用

```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-2.5-flash',
  generationConfig: {
    response_modality: 'audio',
    speech_config: {
      voice_config: {
        prebuilt_voice_config: {
          voice_name: interviewerProfile.voiceSettings.voiceType
        }
      }
    }
  }
})
```

## デモ音声再生機能

インタビュアー設定画面で、各音声タイプのデモを直接再生できます。

### 使い方

1. **インタビュアー設定を開く**
   ```
   http://localhost:3000/dashboard/interviewer
   ```

2. **「新規作成」または既存のインタビュアーを編集**

3. **必須項目を入力**
   - ✅ 名前（必須）
   - ✅ 役割（推奨）
   - ✅ 説明（推奨）

4. **音声タイプを選択**
   - Puck, Charon, Kore, Fenrir, Aoede から選択

5. **「デモ音声を再生」ボタンをクリック**
   - 入力された情報から自動的に自己紹介文を生成
   - 選択した音声タイプで読み上げ
   - 再生中はクリックで停止可能

### デモテキストの例

入力情報：
- 名前: 田中太郎
- 役割: ジャーナリスト
- 説明: 丁寧で親しみやすい対話を心がけています

生成されるデモテキスト：
```
こんにちは、田中太郎です。
私はジャーナリストとして活動しています。
丁寧で親しみやすい対話を心がけています。
```

## テスト方法

1. インタビュアー設定ページで音声タイプを選択
2. デモ音声を再生して、音声の特徴を確認
3. 異なる音声タイプで比較テスト
4. 気に入った音声を保存
5. インタビューで実際に使用

## 参考リンク

- [Gemini 2.5 Flash Native Audio Documentation](https://ai.google.dev/gemini-api/docs/audio)
- [Voice Configuration Guide](https://ai.google.dev/gemini-api/docs/audio#voice-config)

