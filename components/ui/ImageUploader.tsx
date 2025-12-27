'use client'

import { useState } from 'react'
import Image from 'next/image'
import { UploadCloud, Loader2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'

interface ImageUploaderProps {
  onUploadComplete: (url: string) => void
  initialImageUrl?: string
}

export const ImageUploader = ({ onUploadComplete, initialImageUrl }: ImageUploaderProps) => {
  const [isUploading, setIsUploading] = useState(false)
  const [preview, setPreview] = useState<string | null>(initialImageUrl || null)

  const onDrop = async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0]
    if (!file) return

    setIsUploading(true)
    setPreview(URL.createObjectURL(file))

    try {
      // 1. Get a signed URL from our API
      const presignResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
        }),
      })

      if (!presignResponse.ok) {
        throw new Error('Failed to get signed URL')
      }

      const { signedUrl, publicUrl } = await presignResponse.json()

      // 2. Upload the file to R2 using the signed URL
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      })

      if (!uploadResponse.ok) {
        throw new Error('Upload failed')
      }

      // 3. Notify parent component of completion
      onUploadComplete(publicUrl)
      setPreview(publicUrl)
    } catch (error) {
      console.error('Upload error:', error)
      // TODO: Add user-facing error state
      setPreview(initialImageUrl || null) // Revert on error
    } finally {
      setIsUploading(false)
    }
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpeg', '.png', '.gif', '.webp'] },
    multiple: false,
  })

  return (
    <div
      {...getRootProps()}
      className={`relative w-40 h-40 rounded-full border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
        isDragActive ? 'border-primary bg-primary/10' : 'border-gray-300 dark:border-gray-600 hover:border-primary'
      }`}
    >
      <input {...getInputProps()} />

      {preview && (
        <Image
          src={preview}
          alt="Profile preview"
          fill
          className="object-cover rounded-full"
        />
      )}

      <div className={`absolute inset-0 rounded-full bg-black/50 flex items-center justify-center transition-opacity ${
        isUploading || !preview ? 'opacity-100' : 'opacity-0 hover:opacity-100'
      }`}>
        {isUploading ? (
          <Loader2 className="w-8 h-8 text-white animate-spin" />
        ) : (
          <div className="text-center text-white">
            <UploadCloud className="w-8 h-8 mx-auto" />
            <p className="text-xs mt-1">画像をアップロード</p>
          </div>
        )}
      </div>
    </div>
  )
}
