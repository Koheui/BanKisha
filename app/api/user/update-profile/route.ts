
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import * as admin from 'firebase-admin'
import { initializeFirebaseAdmin } from '@/src/lib/firebase-admin'

export async function POST(req: NextRequest) {
  await initializeFirebaseAdmin()

  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { displayName, companyName, bio } = await req.json()
    const db = admin.firestore()

    let companyId: string | undefined = undefined

    // Handle company logic
    if (companyName && typeof companyName === 'string' && companyName.trim() !== '') {
      const companiesRef = db.collection('companies')
      const companyQuery = await companiesRef.where('name', '==', companyName.trim()).limit(1).get()

      if (!companyQuery.empty) {
        // Company exists
        companyId = companyQuery.docs[0].id
      } else {
        // Create new company
        const newCompanyRef = await companiesRef.add({
          name: companyName.trim(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          owner: userId,
        })
        companyId = newCompanyRef.id
      }
    }

    // Update user document
    const userRef = db.collection('users').doc(userId)
    const userDataToUpdate: { [key: string]: any } = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }

    if (displayName !== undefined) {
      userDataToUpdate.displayName = displayName
    }
    if (companyId !== undefined) {
      userDataToUpdate.companyId = companyId
    }
    if (bio !== undefined) {
      userDataToUpdate.bio = bio
    }

    await userRef.update(userDataToUpdate)

    return NextResponse.json({ success: true, message: 'Profile updated successfully', companyId })
  } catch (error) {
    console.error('Error updating profile:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return NextResponse.json({ error: 'Failed to update profile', details: errorMessage }, { status: 500 })
  }
}
