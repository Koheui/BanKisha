'use client'

import { useState, useRef } from 'react'
import Image from 'next/image'
import { UploadCloud, Loader2, Image as ImageIcon } from 'lucide-react'

export function MediaImageUploader() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      setSelectedFile(file)
      setPreviewUrl(URL.createObjectURL(file))
      setError(null)
    }
  }

  const handleUpload = async () => {
    if (!selectedFile) return

    setIsUploading(true)
    setError(null)

    try {
      // 1. Get a signed URL from our API
      const presignResponse = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: selectedFile.name,
          contentType: selectedFile.type,
        }),
      })

      if (!presignResponse.ok) {
        throw new Error('署名付きURLの取得に失敗しました。')
      }

      const { url: signedUrl, key } = await presignResponse.json()

      // 2. Upload the file to R2 using the signed URL
      const uploadResponse = await fetch(signedUrl, {
        method: 'PUT',
        body: selectedFile,
        headers: { 'Content-Type': selectedFile.type },
      })

      if (!uploadResponse.ok) {
        throw new Error('ファイルアップロードに失敗しました。')
      }

      // 3. Construct the public URL and update the preview
      const publicUrl = `${process.env.NEXT_PUBLIC_R2_DOMAIN}/${key}`
      setPreviewUrl(publicUrl)
      setSelectedFile(null)

    } catch (err: any) {
      console.error(err)
      setError(err.message || 'エラーが発生しました。')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto">
      <div 
        className="w-full aspect-video border-2 border-dashed rounded-lg flex items-center justify-center bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 relative"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
          className="hidden"
        />
        {previewUrl ? (
          <Image src={previewUrl} alt="Preview" fill className="object-contain" />
        ) : (
          <div className="text-center">
            <ImageIcon className="w-10 h-10 mx-auto" />
            <p className="mt-2 text-sm">画像を選択</p>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}

      <div className="mt-4 flex justify-center">
        <button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isUploading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              アップロード中...
            </>
          ) : (
            <>
              <UploadCloud className="mr-2 h-4 w-4" />
              アップロード
            </>
          )}
        </button>
      </div>
    </div>
  )
}
