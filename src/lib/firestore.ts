import { getFirebaseDb } from './firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  QueryConstraint
} from 'firebase/firestore'
import type { Article, Company, KnowledgeBase } from '../types'

// Companies
export async function initializeCompany(name: string, userId: string): Promise<string> {
  try {
    const firestoreDb = getFirebaseDb()
    const companyRef = await addDoc(collection(firestoreDb, 'companies'), {
      name,
      onboarded: false,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: userId,
    })
    return companyRef.id
  } catch (error) {
    console.error('Error creating company:', error)
    throw error
  }
}

// Articles
export async function getArticles(status?: string, companyId?: string, category?: string): Promise<Article[]> {
  try {
    const articlesRef = collection(getFirebaseDb(), 'articles')
    const constraints: QueryConstraint[] = []

    if (status) {
      constraints.push(where('status', '==', status))
    }

    if (companyId) {
      constraints.push(where('companyId', '==', companyId))
    }

    if (category) {
      constraints.push(where('category', '==', category))
    }

    constraints.push(orderBy('createdAt', 'desc'))

    const q = query(articlesRef, ...constraints)
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      submittedAt: doc.data().submittedAt?.toDate(),
      approvedAt: doc.data().approvedAt?.toDate(),
      publicMeta: doc.data().publicMeta ? {
        ...doc.data().publicMeta,
        publishedAt: doc.data().publicMeta.publishedAt?.toDate() || new Date(),
        coverImageUrl: doc.data().publicMeta.coverImageUrl || null
      } : undefined,
      publishedAt: doc.data().publishedAt?.toDate(),
      engagement: doc.data().engagement || { views: 0, bookmarks: 0, likes: 0 }
    })) as Article[]
  } catch (error) {
    console.error('Error getting articles:', error)
    throw error
  }
}

export async function getArticle(id: string): Promise<Article | null> {
  try {
    const docRef = doc(getFirebaseDb(), 'articles', id)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate() || new Date(),
      updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
      submittedAt: docSnap.data().submittedAt?.toDate(),
      approvedAt: docSnap.data().approvedAt?.toDate(),
      publishedAt: docSnap.data().publishedAt?.toDate()
    } as Article
  } catch (error) {
    console.error('Error getting article:', error)
    throw error
  }
}

export async function createArticle(article: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  try {
    const docRef = await addDoc(collection(getFirebaseDb(), 'articles'), {
      ...article,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    })
    return docRef.id
  } catch (error) {
    console.error('Error creating article:', error)
    throw error
  }
}

export async function updateArticle(id: string, data: Partial<Article>): Promise<void> {
  try {
    const docRef = doc(getFirebaseDb(), 'articles', id)
    await updateDoc(docRef, {
      ...data,
      updatedAt: Timestamp.now()
    })
  } catch (error) {
    console.error('Error updating article:', error)
    throw error
  }
}

export async function deleteArticle(id: string): Promise<void> {
  try {
    await deleteDoc(doc(getFirebaseDb(), 'articles', id))
  } catch (error) {
    console.error('Error deleting article:', error)
    throw error
  }
}

// Companies
export async function getCompanies(): Promise<Company[]> {
  try {
    const companiesRef = collection(getFirebaseDb(), 'companies')
    const snapshot = await getDocs(companiesRef)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date()
    } as Company))
  } catch (error) {
    console.error('Error getting companies:', error)
    throw error
  }
}

export async function getCompany(id: string): Promise<Company | null> {
  try {
    const docRef = doc(getFirebaseDb(), 'companies', id)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      return null
    }

    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: docSnap.data().createdAt?.toDate() || new Date()
    } as Company
  } catch (error) {
    console.error('Error getting company:', error)
    throw error
  }
}

// Knowledge Bases
export async function getKnowledgeBases(type?: 'skill' | 'info' | 'user', companyId?: string): Promise<KnowledgeBase[]> {
  // クライアント側でのskill/info取得を禁止（機密保護）
  if (typeof window !== 'undefined' && (type === 'skill' || type === 'info')) {
    console.warn('⚠️ Skill/Info knowledge bases are server-only. Access denied.')
    return []
  }

  try {
    const kbRef = collection(getFirebaseDb(), 'knowledgeBases')
    const constraints: QueryConstraint[] = []

    if (type) {
      constraints.push(where('type', '==', type))
    }

    if (companyId) {
      constraints.push(where('companyId', '==', companyId))
    }

    constraints.push(orderBy('createdAt', 'desc'))

    const q = query(kbRef, ...constraints)
    const snapshot = await getDocs(q)

    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date()
    } as KnowledgeBase))
  } catch (error) {
    console.error('Error getting knowledge bases:', error)
    throw error
  }
}

// サーバー側専用: クライアント側から呼び出された場合は空配列を返す
export async function getSkillKnowledgeBases(): Promise<KnowledgeBase[]> {
  if (typeof window !== 'undefined') {
    console.warn('⚠️ getSkillKnowledgeBases is server-only. Access denied.')
    return []
  }
  return getKnowledgeBases('skill')
}

export async function getInfoKnowledgeBases(): Promise<KnowledgeBase[]> {
  if (typeof window !== 'undefined') {
    console.warn('⚠️ getInfoKnowledgeBases is server-only. Access denied.')
    return []
  }
  return getKnowledgeBases('info')
}

export async function getUserKnowledgeBases(companyId: string): Promise<KnowledgeBase[]> {
  return getKnowledgeBases('user', companyId)
}

// Interviews migration
export async function migrateInterviewMessages(interviewId: string): Promise<{ success: boolean; migratedCount: number }> {
  try {
    const firestoreDb = getFirebaseDb()
    const docRef = doc(firestoreDb, 'interviews', interviewId)
    const docSnap = await getDoc(docRef)

    if (!docSnap.exists()) {
      throw new Error('Interview not found')
    }

    const data = docSnap.data()
    const oldMessages = data.messages || []

    if (!Array.isArray(oldMessages) || oldMessages.length === 0) {
      return { success: true, migratedCount: 0 }
    }

    const messagesRef = collection(firestoreDb, 'interviews', interviewId, 'messages')

    let migratedCount = 0
    // 日時順に並んでいると仮定して、少しずつ時間をずらして作成
    const baseTime = data.createdAt ? data.createdAt.toMillis() : Date.now()

    for (let i = 0; i < oldMessages.length; i++) {
      const msg = oldMessages[i]

      const messageData = {
        role: msg.role,
        content: msg.content || '',
        timestamp: msg.timestamp || Timestamp.fromMillis(baseTime + (i * 1000)), // 1秒ずつずらす
        audioUrl: msg.audioUrl || null
      }

      await addDoc(messagesRef, messageData)
      migratedCount++
    }

    // 元の配列を消去し、移行完了マークをつける
    await updateDoc(docRef, {
      messages: [], // 配列を空にする（容量削減のため推奨）
      isMigratedToSubcollection: true,
      updatedAt: Timestamp.now()
    })

    return { success: true, migratedCount }
  } catch (error) {
    console.error('Error migrating messages:', error)
    throw error
  }
}

