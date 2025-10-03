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
  serverTimestamp
} from 'firebase/firestore'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { db, storage } from './firebase'
import type { User, Company, QuestionSet, Article, Session, QARecord } from '../types'

// Users Collection
export const usersCollection = collection(db, 'users')
export const getUser = async (uid: string): Promise<User | null> => {
  const docRef = doc(db, 'users', uid)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? { id: uid, ...docSnap.data() } as User : null
}

// Companies Collection
export const companiesCollection = collection(db, 'companies')
export const getCompany = async (companyId: string): Promise<Company | null> => {
  const docRef = doc(db, 'companies', companyId)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? { id: companyId, ...docSnap.data() } as Company : null
}

export const getCompanies = async (): Promise<Company[]> => {
  const q = query(companiesCollection, orderBy('createdAt', 'desc'))
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Company))
}

export const createCompany = async (companyData: Omit<Company, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(companiesCollection, {
    ...companyData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

// Articles Collection
export const articlesCollection = collection(db, 'articles')
export const getArticle = async (articleId: string): Promise<Article | null> => {
  const docRef = doc(db, 'articles', articleId)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? { id: articleId, ...docSnap.data() } as Article : null
}

export const getArticles = async (status?: string, companyId?: string): Promise<Article[]> => {
  let q = query(articlesCollection)
  
  if (status) {
    q = query(q, where('status', '==', status))
  }
  
  if (companyId) {
    q = query(q, where('companyId', '==', companyId))
  }
  
  q = query(q, orderBy('createdAt', 'desc'))
  const querySnapshot = await getDocs(q)
  
  return querySnapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date()
  } as Article))
}

export const createArticle = async (articleData: Omit<Article, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> => {
  const docRef = await addDoc(articlesCollection, {
    ...articleData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })
  return docRef.id
}

export const updateArticle = async (articleId: string, articleData: Partial<Article>): Promise<void> => {
  const docRef = doc(db, 'articles', articleId)
  await updateDoc(docRef, {
    ...articleData,
    updatedAt: serverTimestamp()
  })
}

// Question Sets Collection
export const questionSetsCollection = collection(db, 'questionSets')
export const getQuestionSet = async (questionSetId: string): Promise<QuestionSet | null> => {
  const docRef = doc(db, 'questionSets', questionSetId)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? { id: questionSetId, ...docSnap.data() } as QuestionSet : null
}

export const getQuestionSets = async (): Promise<QuestionSet[]> => {
  const q = query(questionSetsCollection, orderBy('title'))
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as QuestionSet))
}

// Sessions Collection
export const sessionsCollection = collection(db, 'sessions')
export const getSession = async (sessionId: string): Promise<Session | null> => {
  const docRef = doc(db, 'sessions', sessionId)
  const docSnap = await getDoc(docRef)
  return docSnap.exists() ? { 
    id: sessionId, 
    ...docSnap.data(),
    expiresAt: docSnap.data()?.expiresAt?.toDate() || new Date()
  } as Session : null
}

export const createSession = async (sessionData: Omit<Session, 'id'>): Promise<string> => {
  const docRef = await addDoc(sessionsCollection, sessionData)
  return docRef.id
}

// Storage helpers
export const uploadAudioFile = async (file: File, path: string): Promise<string> => {
  const storageRef = ref(storage, path)
  await uploadBytes(storageRef, file)
  return await getDownloadURL(storageRef)
}

export const deleteAudioFile = async (path: string): Promise<void> => {
  const storageRef = ref(storage, path)
  await deleteObject(storageRef)
}
