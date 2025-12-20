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

// Articles
export async function getArticles(status?: string, companyId?: string): Promise<Article[]> {
  try {
    const articlesRef = collection(getFirebaseDb(), 'articles')
    const constraints: QueryConstraint[] = []
    
    if (status) {
      constraints.push(where('status', '==', status))
    }
    
    if (companyId) {
      constraints.push(where('companyId', '==', companyId))
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
        publishedAt: doc.data().publicMeta.publishedAt?.toDate() || new Date()
      } : undefined
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
      approvedAt: docSnap.data().approvedAt?.toDate()
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

export async function getSkillKnowledgeBases(): Promise<KnowledgeBase[]> {
  return getKnowledgeBases('skill')
}

export async function getInfoKnowledgeBases(): Promise<KnowledgeBase[]> {
  return getKnowledgeBases('info')
}

export async function getUserKnowledgeBases(companyId: string): Promise<KnowledgeBase[]> {
  return getKnowledgeBases('user', companyId)
}


