'use client'

import { useState } from 'react'
import { getAuth } from 'firebase/auth'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { getFirebaseDb } from '@/src/lib/firebase'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

export default function SetupAdminPage() {
  const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle')
  const [message, setMessage] = useState('')
  const [userInfo, setUserInfo] = useState<any>(null)

  const handleSetSuperAdmin = async () => {
    setStatus('processing')
    setMessage('処理中...')

    try {
      const auth = getAuth()
      const user = auth.currentUser

      if (!user) {
        setStatus('error')
        setMessage('❌ ログインしてください')
        return
      }

      setMessage(`📝 ${user.email} をSuperAdminに設定中...`)

      // Firestoreにroleを書き込み
      const firestoreDb = getFirebaseDb()
      const userRef = doc(firestoreDb, 'users', user.uid)
      await setDoc(
        userRef,
        {
          email: user.email,
          displayName: user.displayName || 'Super Admin',
          role: 'superAdmin',
          uid: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      )

      setStatus('success')
      setMessage('✅ SuperAdmin設定完了！')
      setUserInfo({
        uid: user.uid,
        email: user.email,
        role: 'superAdmin',
      })
    } catch (error: any) {
      console.error('Error:', error)
      setStatus('error')
      setMessage(`❌ エラー: ${error.message}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8 bg-white/10 backdrop-blur-lg border-white/20">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            🔴 Super Admin セットアップ
          </h1>
          <p className="text-gray-300">
            現在ログイン中のユーザーをSuperAdminに設定します
          </p>
        </div>

        <div className="space-y-6">
          {/* 設定ボタン */}
          <div className="flex justify-center">
            <Button
              onClick={handleSetSuperAdmin}
              disabled={status === 'processing'}
              className="px-12 py-6 text-xl font-bold bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white shadow-lg"
            >
              {status === 'processing' ? '処理中...' : 'SuperAdminに設定する'}
            </Button>
          </div>

          {/* ステータス表示 */}
          {message && (
            <div
              className={`p-6 rounded-lg text-center text-lg font-bold ${
                status === 'success'
                  ? 'bg-green-500/20 border-2 border-green-500 text-green-300'
                  : status === 'error'
                  ? 'bg-red-500/20 border-2 border-red-500 text-red-300'
                  : 'bg-blue-500/20 border-2 border-blue-500 text-blue-300'
              }`}
            >
              {message}
            </div>
          )}

          {/* ユーザー情報 */}
          {userInfo && (
            <div className="p-6 bg-gray-800/50 rounded-lg border-2 border-gray-700">
              <h3 className="text-xl font-bold text-white mb-4">ユーザー情報</h3>
              <div className="space-y-2 text-gray-300">
                <p>
                  <span className="font-bold">UID:</span> {userInfo.uid}
                </p>
                <p>
                  <span className="font-bold">Email:</span> {userInfo.email}
                </p>
                <p>
                  <span className="font-bold text-red-500">Role:</span>{' '}
                  <span className="text-red-500 font-bold">{userInfo.role}</span>
                </p>
              </div>
            </div>
          )}

          {/* 成功後の指示 */}
          {status === 'success' && (
            <div className="p-6 bg-yellow-500/20 border-2 border-yellow-500 rounded-lg">
              <h3 className="text-xl font-bold text-yellow-300 mb-4">
                🎉 次のステップ
              </h3>
              <ol className="list-decimal list-inside space-y-2 text-gray-300">
                <li>ページをリロード（Command/Ctrl + R）</li>
                <li>ダッシュボードに移動</li>
                <li>赤いバッジと赤いセクションを確認</li>
              </ol>
              <div className="mt-6 flex gap-4 justify-center">
                <Button
                  onClick={() => window.location.reload()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  🔄 ページをリロード
                </Button>
                <Button
                  onClick={() => (window.location.href = '/dashboard')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  📊 ダッシュボードへ
                </Button>
              </div>
            </div>
          )}

          {/* 説明 */}
          <div className="p-6 bg-gray-800/30 rounded-lg border border-gray-700">
            <h3 className="text-lg font-bold text-white mb-3">📋 使用方法</h3>
            <ol className="list-decimal list-inside space-y-2 text-gray-300">
              <li>
                <code className="bg-gray-900 px-2 py-1 rounded">
                  office@futurestudio.co.jp
                </code>{' '}
                でログイン
              </li>
              <li>
                <code className="bg-gray-900 px-2 py-1 rounded">
                  http://localhost:3000/setup-admin
                </code>{' '}
                にアクセス
              </li>
              <li>「SuperAdminに設定する」ボタンをクリック</li>
              <li>完了後、ページをリロード</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  )
}

