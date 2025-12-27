'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Loader2, ShieldCheck, ShieldAlert, Database, User, Globe } from 'lucide-react'

export default function AuthDebugPage() {
    const { user: clerkUser, isLoaded: clerkLoaded } = useUser()
    const [apiData, setApiData] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchDebug() {
            try {
                const res = await fetch('/api/user/profile')
                const data = await res.json()
                setApiData(data)
            } catch (e) {
                setApiData({ error: 'Failed to fetch API data' })
            } finally {
                setLoading(false)
            }
        }

        if (clerkLoaded) {
            fetchDebug()
        }
    }, [clerkLoaded])

    if (!clerkLoaded || loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
            </div>
        )
    }

    const firestoreExists = apiData?._debug?.exists
    const envHasKey = apiData?._debug?.envHasKey

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
            <div className="max-w-4xl mx-auto space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold mb-2">Auth & Firestore 診断ダッシュボード</h1>
                    <p className="text-gray-600">スーパーアドミン権限が反映されない原因を特定します。</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Clerk Info */}
                    <Card>
                        <CardHeader className="bg-blue-50 dark:bg-blue-950">
                            <div className="flex items-center gap-2">
                                <User className="text-blue-600" />
                                <CardTitle>1. Clerk側の認識 (Client)</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div>
                                <p className="text-sm font-semibold text-gray-500">Clerk User ID:</p>
                                <code className="block bg-gray-100 p-2 rounded mt-1 break-all">{clerkUser?.id}</code>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500">Email:</p>
                                <p>{clerkUser?.primaryEmailAddress?.emailAddress}</p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* API Debug Info */}
                    <Card>
                        <CardHeader className={firestoreExists ? "bg-green-50 dark:bg-green-950" : "bg-red-50 dark:bg-red-950"}>
                            <div className="flex items-center gap-2">
                                <Database className={firestoreExists ? "text-green-600" : "text-red-600"} />
                                <CardTitle>2. Firestore側の認識 (Server)</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <span>ドキュメントの有無:</span>
                                {firestoreExists ? (
                                    <Badge className="bg-green-600">FOUND (OK)</Badge>
                                ) : (
                                    <Badge variant="destructive">NOT FOUND (Error)</Badge>
                                )}
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500">サーバーが見ているUserID:</p>
                                <code className="block bg-gray-100 p-2 rounded mt-1 break-all">{apiData?._debug?.userId}</code>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-500">Firestore 役職 (role):</p>
                                <Badge variant={apiData?.role === 'superAdmin' ? "default" : "secondary"}>
                                    {apiData?.role || 'null'}
                                </Badge>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* System Health */}
                <Card>
                    <CardHeader>
                        <div className="flex items-center gap-2">
                            <Globe className="text-purple-600" />
                            <CardTitle>3. システム構成の整合性</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6">
                        <div className="space-y-4">
                            <div className="flex items-center gap-3">
                                {envHasKey ? <ShieldCheck className="text-green-600" /> : <ShieldAlert className="text-red-600" />}
                                <div>
                                    <p className="font-semibold">Vercel 環境変数 (FIREBASE_PRIVATE_KEY)</p>
                                    <p className="text-sm text-gray-500">{envHasKey ? "設定されています" : "❌ 未設定または空（致命的）"}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {apiData?._debug?.projectId !== 'undefined' ? <ShieldCheck className="text-green-600" /> : <ShieldAlert className="text-red-600" />}
                                <div>
                                    <p className="font-semibold">Firebase Project ID</p>
                                    <code className="text-sm text-gray-500">{apiData?._debug?.projectId}</code>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                            <h3 className="font-bold mb-2">💡 解決のためのヒント</h3>
                            <ul className="text-sm space-y-2 list-disc pl-4">
                                <li>
                                    <strong>「NOT FOUND」の場合:</strong> <br />
                                    Firestoreの <code>users</code> コレクションにあるドキュメントIDが、左記の <code>Clerk User ID</code> と一字一句違わず一致しているか確認してください。
                                </li>
                                <li>
                                    <strong>「role」が違う場合:</strong> <br />
                                    Firestoreドキュメント内の <code>role</code> フィールドが <code>superAdmin</code> になっているか確認してください。
                                </li>
                                <li>
                                    <strong>環境変数が❌の場合:</strong> <br />
                                    Vercelの管理画面で秘密鍵が正しく入力されているか確認してください。
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
