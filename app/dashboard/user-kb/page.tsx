'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb, getFirebaseStorage } from '@/src/lib/firebase'
import { collection, query, where, getDocs, doc, orderBy, updateDoc, Timestamp } from 'firebase/firestore'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { KnowledgeBase } from '@/src/types/index'
import Link from 'next/link'
import {
    ArrowLeftIcon,
    DatabaseIcon,
    UploadIcon,
    TrashIcon,
    FileIcon,
    CheckCircleIcon,
    XCircleIcon,
    LoaderIcon,
    AlertCircleIcon
} from 'lucide-react'

const COMPONENT_VERSION = '2024-12-26-UserKB-v2'

export default function UserKBPage() {
    const { user, loading } = useAuth()
    const router = useRouter()
    const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
    const [loadingData, setLoadingData] = useState(true)
    const [uploading, setUploading] = useState(false)
    const [uploadProgress, setUploadProgress] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    console.log(`🚀 [UserKB] Version: ${COMPONENT_VERSION}`)

    // ログイン確認
    useEffect(() => {
        if (!loading && !user) {
            router.push('/login')
        }
    }, [user, loading, router])

    // ユーザーKBの一覧を取得
    useEffect(() => {
        if (!loading && user) {
            loadKnowledgeBases()
        }
    }, [loading, user])

    const loadKnowledgeBases = async () => {
        if (!user) return

        try {
            setLoadingData(true)
            const firestoreDb = getFirebaseDb()
            const kbRef = collection(firestoreDb, 'knowledgeBases')

            // ユーザー別（uploadedBy）に取得
            const q = query(
                kbRef,
                where('type', '==', 'user'),
                where('uploadedBy', '==', user.uid),
                orderBy('createdAt', 'desc')
            )

            const snapshot = await getDocs(q)
            const kbs = snapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate() || new Date(),
                    updatedAt: doc.data().updatedAt?.toDate() || new Date()
                } as KnowledgeBase))
                .filter(kb => !kb.deleted)

            setKnowledgeBases(kbs)
        } catch (error) {
            console.error('Error loading user knowledge bases:', error)
        } finally {
            setLoadingData(false)
        }
    }

    const handleFileSelect = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file || !user) return

        if (file.type !== 'application/pdf') {
            alert('❌ PDFファイルのみアップロード可能です')
            return
        }

        try {
            setUploading(true)
            setUploadProgress(0)

            if (!user) throw new Error('ログインが必要です')
            const timestamp = Date.now()
            const encodedFileName = encodeURIComponent(file.name)
            const firebaseStorage = getFirebaseStorage()

            // ユーザーIDをパスに含める
            const storageRef = ref(firebaseStorage, `knowledge-bases/user/${user.uid}/${timestamp}-${encodedFileName}`)

            const uploadTask = uploadBytesResumable(storageRef, file, {
                contentType: 'application/pdf'
            })

            uploadTask.on(
                'state_changed',
                (snapshot) => {
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100
                    setUploadProgress(progress)
                },
                (error) => {
                    console.error('❌ [Upload] Storage error:', error)
                    throw error
                },
                async () => {
                    try {
                        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref)

                        const response = await fetch('/api/knowledge-base/create', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                type: 'user',
                                fileName: file.name,
                                fileSize: file.size,
                                storageUrl: downloadURL,
                                storagePath: uploadTask.snapshot.ref.fullPath
                            })
                        })

                        if (!response.ok) {
                            const errorData = await response.json()
                            throw new Error(errorData.error || 'ナレッジベースの作成に失敗しました')
                        }

                        alert('✅ アップロードが完了しました。PDFの解析を開始します。')
                        await loadKnowledgeBases()

                        if (fileInputRef.current) fileInputRef.current.value = ''
                    } catch (error: any) {
                        console.error('❌ [Upload] API error:', error)
                        alert(`❌ ナレッジベースの登録に失敗しました: ${error.message}`)
                    } finally {
                        setUploading(false)
                        setUploadProgress(0)
                    }
                }
            )
        } catch (error: any) {
            console.error('Error uploading PDF:', error)
            alert(`❌ アップロードに失敗しました: ${error.message}`)
            setUploading(false)
        }
    }

    const handleDelete = async (kb: KnowledgeBase) => {
        if (!confirm(`「${kb.fileName}」を削除してもよろしいですか？`)) {
            return
        }

        try {
            const firestoreDb = getFirebaseDb()
            const kbRef = doc(firestoreDb, 'knowledgeBases', kb.id)

            await updateDoc(kbRef, {
                deleted: true,
                deletedAt: Timestamp.now(),
                deletedBy: user?.uid
            })

            alert('✅ 削除しました')
            await loadKnowledgeBases()
        } catch (error) {
            console.error('Error deleting KB:', error)
            alert('❌ 削除に失敗しました')
        }
    }

    const handleCategoryChange = async (kbId: string, category: string) => {
        try {
            const firestoreDb = getFirebaseDb()
            const kbRef = doc(firestoreDb, 'knowledgeBases', kbId)

            await updateDoc(kbRef, {
                category: category,
                updatedAt: Timestamp.now()
            })

            setKnowledgeBases(prev =>
                prev.map(kb =>
                    kb.id === kbId
                        ? { ...kb, category }
                        : kb
                )
            )
        } catch (error) {
            console.error('Error updating category:', error)
        }
    }

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'indexed':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-full text-sm font-medium">
                        <CheckCircleIcon className="w-4 h-4" />
                        <span>解析完了</span>
                    </div>
                )
            case 'processing':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm font-medium">
                        <LoaderIcon className="w-4 h-4 animate-spin" />
                        <span>解析中...</span>
                    </div>
                )
            case 'failed':
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300 rounded-full text-sm font-medium">
                        <XCircleIcon className="w-4 h-4" />
                        <span>失敗</span>
                    </div>
                )
            default:
                return (
                    <div className="flex items-center gap-1.5 px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 rounded-full text-sm font-medium">
                        <AlertCircleIcon className="w-4 h-4" />
                        <span>{status}</span>
                    </div>
                )
        }
    }

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
    }

    const formatDate = (date: Date) => {
        return new Intl.DateTimeFormat('ja-JP', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        }).format(date)
    }

    if (loading || (loadingData && knowledgeBases.length === 0)) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                    <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
                        >
                            <ArrowLeftIcon className="w-5 h-5" />
                            <span>戻る</span>
                        </Link>
                        <div className="flex items-center gap-3">
                            <DatabaseIcon className="w-8 h-8 text-orange-600 dark:text-orange-400" />
                            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                                ユーザーナレッジベース
                            </h1>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Description */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                        あなた専用のナレッジベース
                    </h2>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                        個人で管理したい専門知識や、特定の取材用資料（野球、料理、専門技術など）のPDFをアップロードしてください。
                        ここでアップロードした資料は、あなただけのプライベートなナレッジとして保存され、インタビュー作成時に自由に選択して活用できます。
                    </p>
                </div>

                {/* Upload Section */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        新しい資料をアップロード
                    </h2>
                    <div className="space-y-4">
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="application/pdf"
                            onChange={handleFileChange}
                            className="hidden"
                        />
                        <button
                            type="button"
                            onClick={handleFileSelect}
                            disabled={uploading}
                            className="flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-md"
                        >
                            <UploadIcon className="w-5 h-5" />
                            {uploading ? 'アップロード中...' : 'PDFを選択してアップロード'}
                        </button>
                        {uploading && (
                            <div className="space-y-2">
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                    <div
                                        className="bg-orange-600 h-2.5 rounded-full transition-all duration-300"
                                        style={{ width: `${uploadProgress}%` }}
                                    ></div>
                                </div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    アップロード中: {uploadProgress.toFixed(1)}%
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Knowledge Bases List */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 font-bold">
                        登録済み資料（{knowledgeBases.length}件）
                    </h2>
                    {knowledgeBases.length === 0 ? (
                        <div className="text-center py-12">
                            <FileIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 dark:text-gray-400">
                                まだ資料がありません。上のボタンからアップロードしてください。
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {knowledgeBases.map((kb) => (
                                <div
                                    key={kb.id}
                                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-5 hover:border-orange-300 dark:hover:border-orange-700 transition-colors bg-gray-50/30 dark:bg-gray-800/30"
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-3 mb-3">
                                                <FileIcon className="w-6 h-6 text-orange-600 dark:text-orange-400 flex-shrink-0" />
                                                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate">
                                                    {kb.fileName}
                                                </h3>
                                                {getStatusBadge(kb.status)}
                                            </div>

                                            {/* ジャンル・カテゴリー設定（強調） */}
                                            <div className="ml-9 mb-4 p-3 bg-white dark:bg-gray-900 rounded-lg border border-orange-100 dark:border-orange-900/30 shadow-sm inline-flex items-center gap-3">
                                                <span className="text-sm font-bold text-orange-600 dark:text-orange-400">専門ジャンル:</span>
                                                <input
                                                    type="text"
                                                    value={kb.category || ''}
                                                    onChange={(e) => handleCategoryChange(kb.id, e.target.value)}
                                                    placeholder="野球、料理、専門スキル等を入力"
                                                    className="text-sm px-3 py-1.5 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-orange-500 outline-none w-64 shadow-inner"
                                                />
                                            </div>

                                            <div className="ml-9 text-sm text-gray-500 dark:text-gray-400 flex gap-4">
                                                <span>サイズ: {formatFileSize(kb.fileSize)}</span>
                                                <span>アップロード: {formatDate(kb.createdAt)}</span>
                                                {kb.pageCount && <span>{kb.pageCount} ページ</span>}
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(kb)}
                                            className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                            title="削除"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
