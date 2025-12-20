'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseAuth, getFirebaseDb } from '@/src/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import Link from 'next/link'
import { ArrowLeftIcon, CompassIcon, SaveIcon } from 'lucide-react'

export default function AppDirectionPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [directionPrompt, setDirectionPrompt] = useState('')
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(true)

  // superAdminのみアクセス可能
  useEffect(() => {
    if (!loading && !user) {
      router.push('/login')
    } else if (!loading && user && user.role !== 'superAdmin') {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  useEffect(() => {
    const loadDirectionPrompt = async () => {
      try {
        const firestoreDb = getFirebaseDb()
        const settingsRef = doc(firestoreDb, 'systemSettings', 'appDirection')
        const settingsDoc = await getDoc(settingsRef)
        
        if (settingsDoc.exists()) {
          const data = settingsDoc.data()
          setDirectionPrompt(data.directionPrompt || '')
        }
      } catch (error) {
        console.error('Error loading app direction:', error)
      } finally {
        setLoadingData(false)
      }
    }

    if (!loading && user?.role === 'superAdmin') {
      loadDirectionPrompt()
    }
  }, [loading, user])

  const handleSave = async () => {
    try {
      setSaving(true)
      const firebaseAuth = getFirebaseAuth()
      const currentUser = firebaseAuth.currentUser
      if (!currentUser) {
        throw new Error('ログインが必要です')
      }
      
      const firestoreDb = getFirebaseDb()
      const settingsRef = doc(firestoreDb, 'systemSettings', 'appDirection')
      await setDoc(settingsRef, {
        directionPrompt: directionPrompt.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: currentUser.uid
      }, { merge: true })
      
      alert('✅ 保存しました')
    } catch (error: any) {
      console.error('Error saving:', error)
      alert(`❌ 保存に失敗しました: ${error.message}`)
    } finally {
      setSaving(false)
    }
  }

  if (loading || loadingData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
        </div>
      </div>
    )
  }

  if (!user || user.role !== 'superAdmin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">アクセス権限がありません</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                href="/dashboard"
                className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
              >
                <ArrowLeftIcon className="w-5 h-5" />
                <span>戻る</span>
              </Link>
              <div className="flex items-center gap-3">
                <CompassIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  🔴 アプリの方向性プロンプト設定
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-100 dark:bg-red-900/30 rounded-full border border-red-300 dark:border-red-700">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-red-900 dark:text-red-300">Super Admin専用</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
              このアプリの方向性を定義
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              このプロンプトは、AIインタビュアーアプリ全体の基本的な方向性と哲学を定義します。
              すべてのインタビュー、記事生成、ナレッジベース検索において、この方向性が最優先で適用されます。
            </p>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">💡 使用例</h3>
              <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                <li>• アプリの根本的な性質（例：「このアプリはビジネスメディア向けの専門ツールです」）</li>
                <li>• 重視する価値観（例：「中立性、深い洞察、実践的な知見を重視します」）</li>
                <li>• 対象読者（例：「経営者、起業家、投資家向けのコンテンツを作成します」）</li>
                <li>• トーン・スタイル（例：「プロフェッショナルでありながら、親しみやすい文体を心がけます」）</li>
              </ul>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label 
                htmlFor="direction-prompt-textarea" 
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                方向性プロンプト
              </label>
              <textarea
                id="direction-prompt-textarea"
                rows={16}
                value={directionPrompt}
                onChange={(e) => setDirectionPrompt(e.target.value)}
                placeholder="例：

このアプリは、ビジネスメディア向けのAIインタビュアーツールです。

【基本方針】
1. プロフェッショナルな取材姿勢
   - 中立性を保ちながら、深い洞察を引き出す
   - 聞き手として謙虚であり、学ぶ姿勢を忘れない

2. 読者第一主義
   - 経営者、起業家、投資家が求める実践的な知見を提供
   - 抽象論ではなく、具体的な事例やデータを重視

3. 文章スタイル
   - プロフェッショナルでありながら、親しみやすく
   - 専門用語は必要に応じて説明を加える
   - ストーリー性を大切にする

4. 時代性の重視
   - スタートアップ・イノベーション文化への理解
   - グローバルな視点とローカルな実情のバランス"
                className="block w-full px-4 py-3 text-base border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                disabled={saving}
              />
              <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                {directionPrompt.length} 文字
              </p>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Link
                href="/dashboard"
                className="px-6 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                キャンセル
              </Link>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || !directionPrompt.trim()}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
              >
                <SaveIcon className="w-4 h-4" />
                {saving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

