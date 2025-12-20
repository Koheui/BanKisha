# Gemini モデル名のメモ

## ✅ 動作確認済みモデル名

### `gemini-2.5-flash`
- **使用場所**: 
  - `app/api/interview/generate-questions/route.ts`
  - `functions/src/index.ts`
- **用途**: 質問生成、要約生成、活用方法生成
- **動作確認日**: 2024年12月
- **ステータス**: ✅ 動作確認済み

## ❌ 使用不可のモデル名

### `gemini-1.5-flash`
- **エラー**: `404 Not Found - models/gemini-1.5-flash is not found`
- **原因**: v1beta APIでは存在しない
- **注意**: 使用しないこと

### `gemini-1.5-flash-latest`
- **状態**: 未確認
- **注意**: 使用前に動作確認が必要

## 📝 注意事項

1. **一貫性を保つ**: プロジェクト全体で同じモデル名を使用すること
2. **エラーが出た場合**: モデル名を変更する前に、APIキーの設定を確認すること
3. **新しいモデルを試す場合**: 必ず動作確認を行い、このドキュメントを更新すること

## 🔗 関連ファイル

- `app/api/interview/generate-questions/route.ts` - 質問生成API
- `functions/src/index.ts` - PDF処理と要約生成

## 📅 更新履歴

- 2024年12月: `gemini-2.5-flash` が動作確認済みであることを記録


