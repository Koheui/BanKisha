import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { updateUser } from '@/src/lib/firestore'

export async function POST(request: Request) {
  try {
    const { userId } = auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const body = await request.json()
    const { displayName, bio, photoURL } = body

    const updateData: { [key: string]: any } = {}
    if (displayName) updateData.displayName = displayName
    if (bio) updateData.bio = bio
    if (photoURL) updateData.photoURL = photoURL

    if (Object.keys(updateData).length === 0) {
      return new NextResponse('No fields to update', { status: 400 })
    }

    await updateUser(userId, updateData)

    return NextResponse.json({ success: true, message: 'Profile updated successfully' })
  } catch (error) {
    console.error('Error updating profile:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
