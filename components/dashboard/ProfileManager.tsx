'use client'

import { useState, useEffect } from 'react'
import { useAuth } from '@/components/auth/AuthProvider'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { doc, getDoc, getFirestore } from 'firebase/firestore'

export default function ProfileManager() {
  const { user, firebaseUser } = useAuth()
  const [displayName, setDisplayName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [bio, setBio] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [companyId, setCompanyId] = useState<string | undefined>(undefined);


  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '')
      setCompanyId(user.companyId)
      setBio(user.bio || '')
    }
  }, [user])

  useEffect(() => {
    if (companyId) {
      const fetchCompanyName = async () => {
        const db = getFirestore();
        const companyDoc = await getDoc(doc(db, "companies", companyId));
        if (companyDoc.exists()) {
          setCompanyName(companyDoc.data().name);
        }
      };
      fetchCompanyName();
    } else {
      setCompanyName('');
    }
  }, [companyId]);

  const handleSave = async () => {
    if (!firebaseUser) {
      setMessage('エラー: 認証されていません。');
      return;
    }

    setIsLoading(true)
    setMessage('')

    try {
      const token = await firebaseUser.getIdToken()
      const response = await fetch('/api/user/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ displayName, companyName, bio }),
      })

      const data = await response.json()

      if (response.ok) {
        setMessage('プロフィールが正常に更新されました。')
        if (data.companyId) {
          setCompanyId(data.companyId);
        }
      } else {
        setMessage(`エラー: ${data.error}`)
      }
    } catch (error) {
      console.error('Failed to update profile:', error)
      setMessage('プロフィールの更新に失敗しました。')
    } finally {
      setIsLoading(false)
    }
  }

  if (!user) {
    return null
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>ユーザー情報</CardTitle>
        <CardDescription>表示名や所属会社情報を編集できます。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email">メールアドレス</Label>
          <Input id="email" type="email" value={user.email || ''} disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="displayName">表示名</Label>
          <Input
            id="displayName"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="山田 太郎"
          />
        </div>
        <div className="space-y-2 pb-2">
          <Label htmlFor="companyName">会社名</Label>
          <Input
            id="companyName"
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="株式会社〇〇"
            className={!user.companyId ? "border-orange-400 focus-visible:ring-orange-400" : ""}
          />
          {!user.companyId ? (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-md">
              <p className="text-sm text-orange-800 font-medium">
                ⚠️ インタビューを作成するには会社名の登録が必要です。
              </p>
              <p className="text-xs text-orange-700 mt-1">
                会社名を登録（保存）すると、あなた専用のインタビュー・記事管理スペースが作成されます。
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              会社名を登録すると、会社専用の機能が利用可能になります。
            </p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="bio">自己紹介 / バイオ</Label>
          <textarea
            id="bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="インタビュアーとしての経歴や、あなたの想いについて詳しく教えてください。"
            className="w-full min-h-[100px] px-3 py-2 text-sm rounded-md border border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? '保存中...' : '保存'}
        </Button>
        {message && <p className="text-sm mt-4">{message}</p>}
      </CardContent>
    </Card>
  )
}
