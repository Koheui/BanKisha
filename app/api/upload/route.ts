import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { R2 } from '@/src/lib/r2'
import { v4 as uuidv4 } from 'uuid'

export async function POST(request: Request) {
  try {
    const { userId } = await auth()
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 })
    }

    const { filename, contentType } = await request.json()
    if (!filename || !contentType) {
      return new NextResponse('Filename and content type are required', {
        status: 400,
      })
    }

    const key = `uploads/${uuidv4()}-${filename}`
    const bucketName = process.env.R2_BUCKET_NAME

    if (!bucketName) {
      return new NextResponse('R2 bucket name is not configured', { status: 500 })
    }

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: key,
      ContentType: contentType,
    })

    const url = await getSignedUrl(R2, command, {
      expiresIn: 300, // 5 minutes
    })

    return NextResponse.json({
      url,
      key,
    })
    
  } catch (error) {
    console.error('Error generating signed URL:', error)
    return new NextResponse('Internal Server Error', { status: 500 })
  }
}
