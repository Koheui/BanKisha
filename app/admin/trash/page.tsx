'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/auth/AuthProvider'
import { getFirebaseDb, getFirebaseStorage } from '@/src/lib/firebase'
import { collection, query, where, getDocs, deleteDoc, doc, updateDoc, orderBy } from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { KnowledgeBase } from '@/src/types'
import Link from 'next/link'
import {
  ArrowLeftIcon,
  TrashIcon,
  RotateCcwIcon,
  XCircleIcon,
  FileIcon,
  AlertCircleIcon
} from 'lucide-react'

export default function TrashPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([])
  const [loadingData, setLoadingData] = useState(true)

  // superAdminのみアクセス可能
  useEffect(() => {
    if (!loading && !user) {
      router.push('/sign-in')
    } else if (!loading && user && user.role !== 'superAdmin') {
      router.push('/dashboard')
    }
  }, [user, loading, router])

  // 削除されたナレッジベースの一覧を取得
  useEffect(() => {
    if (!loading && user?.role === 'superAdmin') {
      loadDeletedKnowledgeBases()
    }
  }, [loading, user])

  const loadDeletedKnowledgeBases = async () => {
    try {
      setLoadingData(true)
      const firestoreDb = getFirebaseDb()
      const kbRef = collection(firestoreDb, 'knowledgeBases')
      const q = query(
        kbRef,
        orderBy('deletedAt', 'desc')
      )
      const snapshot = await getDocs(q)
      const kbs = snapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
          deletedAt: doc.data().deletedAt?.toDate()
        } as KnowledgeBase))
        .filter(kb => kb.deleted === true)
      setKnowledgeBases(kbs)
    } catch (error) {
      console.error('Error loading deleted knowledge bases:', error)
      alert('❌ ゴミ箱の読み込みに失敗しました')
    } finally {
      setLoadingData(false)
    }
  }

  const handleRestore = async (kb: KnowledgeBase) => {
    if (!confirm(`「${kb.fileName}」を復元してもよろしいですか？`)) {
      return
    }

    try {
      const firestoreDb = getFirebaseDb()
      const kbRef = doc(firestoreDb, 'knowledgeBases', kb.id)
      await updateDoc(kbRef, {
        deleted: false,
        deletedAt: null
      })

      alert('✅ 復元しました')
      await loadDeletedKnowledgeBases()
    } catch (error) {
      console.error('Error restoring KB:', error)
      alert('❌ 復元に失敗しました')
    }
  }

  const handlePermanentDelete = async (kb: KnowledgeBase) => {
    if (!confirm(`「${kb.fileName}」を完全に削除してもよろしいですか？\n\n⚠️ この操作は取り消せません。`)) {
      return
    }

    if (!confirm('本当に削除しますか？\n\n完全に削除すると、復元できなくなります。')) {
      return
    }

    try {
      // Storageからファイルを削除
      try {
        const firebaseStorage = getFirebaseStorage()
        const storageRef = ref(firebaseStorage, kb.storageUrl)
        await deleteObject(storageRef)
      } catch (storageError) {
        console.warn('Storage file not found or already deleted:', storageError)
      }

      // Firestoreから完全削除
      const firestoreDb = getFirebaseDb()
      await deleteDoc(doc(firestoreDb, 'knowledgeBases', kb.id))

      alert('✅ 完全に削除しました')
      await loadDeletedKnowledgeBases()
    } catch (error) {
      console.error('Error permanently deleting KB:', error)
      alert('❌ 削除に失敗しました')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (date?: Date) => {
    if (!date) return '-'
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date)
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'skill':
        return 'スキルKB'
      case 'info':
        return '情報KB'
      case 'user':
        return 'ユーザーKB'
      default:
        return type
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
                <TrashIcon className="w-8 h-8 text-red-600 dark:text-red-400" />
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  🔴 ゴミ箱
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Description */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
            ゴミ箱について
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
            削除されたナレッジベースは、ここに一時的に保管されます。
            復元するか、完全に削除するかを選択できます。
          </p>
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-yellow-900 dark:text-yellow-300 mb-2">⚠️ 注意事項</h3>
            <ul className="text-sm text-yellow-800 dark:text-yellow-400 space-y-1">
              <li>• 「復元」: ナレッジベースを元の場所に戻します</li>
              <li>• 「完全削除」: ストレージとデータベースから完全に削除します（取り消し不可）</li>
            </ul>
          </div>
        </div>

        {/* Trash List */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            削除済みナレッジベース（{knowledgeBases.length}件）
          </h2>
          {knowledgeBases.length === 0 ? (
            <div className="text-center py-12">
              <TrashIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                ゴミ箱は空です
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                削除されたナレッジベースはここに表示されます
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {knowledgeBases.map((kb) => (
                <div
                  key={kb.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <FileIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {kb.fileName}
                        </h3>
                        <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded">
                          {getTypeLabel(kb.type)}
                        </span>
                      </div>
                      <div className="ml-8 space-y-1 text-sm text-gray-600 dark:text-gray-400">
                        <p>サイズ: {formatFileSize(kb.fileSize)}</p>
                        <p>削除日時: {formatDate(kb.deletedAt)}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-500">
                          作成日時: {formatDate(kb.createdAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                      <button
                        onClick={() => handleRestore(kb)}
                        className="flex items-center gap-2 px-4 py-2 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                      >
                        <RotateCcwIcon className="w-4 h-4" />
                        <span>復元</span>
                      </button>
                      <button
                        onClick={() => handlePermanentDelete(kb)}
                        className="flex items-center gap-2 px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      >
                        <XCircleIcon className="w-4 h-4" />
                        <span>完全削除</span>
                      </button>
                    </div>
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


