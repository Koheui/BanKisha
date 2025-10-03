'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useAuth } from '@/components/auth/AuthProvider'
import { useToast } from '@/components/ui/toaster'
import { AlertCircleIcon, EyeIcon, EyeOffIcon, UserPlusIcon, MailIcon, LockIcon, BuildingIcon } from 'lucide-react'

export default function SignupPage() {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    companyName: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  const { signUp } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.displayName || !formData.companyName) {
      return 'すべての項目を入力してください'
    }
    
    if (formData.password !== formData.confirmPassword) {
      return 'パスワードが一致しません'
    }
    
    if (formData.password.length < 6) {
      return 'パスワードは6文字以上で入力してください'
    }
    
    return null
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    const validationError = validateForm()
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    setError('')

    try {
      const userCredential = await signUp(formData.email, formData.password)
      
      // Update user document with additional info
      if (userCredential.user) {
        // TODO: Create company and link to user
        toast({
          title: '登録完了！',
          description: 'アカウントが正常に作成されました。',
          type: 'success'
        })
        
        router.push('/dashboard')
      }
    } catch (err: any) {
      console.error('Signup error:', err)
      
      let errorMessage = '新規登録に失敗しました'
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'このメールアドレスは既に使用されています'
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'パスワードが弱すぎます'
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = '無効なメールアドレスです'
      }
      
      setError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-950 dark:to-indigo-900">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="flex items-center justify-center mb-4">
            <div className="w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
              <UserPlusIcon className="w-7 h-7 text-white" />
            </div>
          </div>
          <h2 className="text-3xl font-bold gradient-text">
            BanKisha 新規登録
          </h2>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            アカウントを作成して企業インタビューを開始
          </p>
        </div>

        {/* Signup Form */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">新規登録</CardTitle>
            <CardDescription className="text-center">
              企業様のみご利用いただけます
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md">
                  <AlertCircleIcon className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                  <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
                </div>
              )}
              
              {/* Company Name */}
              <div>
                <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  会社名 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <BuildingIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="companyName"
                    name="companyName"
                    type="text"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:bg-gray-800 rounded-md shadow-sm placeholder-gray-400 focus:outline-none dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="会社名を入力"
                    value={formData.companyName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              {/* Display Name */}
              <div>
                <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  お名前 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="displayName"
                    name="displayName"
                    type="text"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:bg-gray-800 rounded-md shadow-sm placeholder-gray-400 focus:outline-none dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="お名前を入力"
                    value={formData.displayName}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  メールアドレス <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <MailIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:bg-gray-800 rounded-md shadow-sm placeholder-gray-400 focus:outline-none dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="your@example.com"
                    value={formData.email}
                    onChange={handleChange}
                    disabled={loading}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  パスワード <span className="text-red-500">*</span>


                </label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:bg-gray-800 rounded-md shadow-sm placeholder-gray-400 focus:outline-none dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="6文字以上で入力"
                    value={formData.password}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => setShowPassword(!showPassword)}
                    disabled={loading}
                  >
                    {showPassword ? (
                      <EyeOffIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  パスワード確認 <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    required
                    className="w-full pl-10 pr-10 py-2 border border-gray-300 dark:bg-gray-800 rounded-md shadow-sm placeholder-gray-400 focus:outline-none dark:text-white focus:ring-blue-500 focus:border-blue-500"
                    placeholder="パスワードを再入力"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    disabled={loading}
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    disabled={loading}
                  >
                    {showConfirmPassword ? (
                      <EyeOffIcon className="w-5 h-5" />
                    ) : (
                      <EyeIcon className="w-5 h-5" />
                    )}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                variant="gradient"
                disabled={loading}
              >
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    登録中...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <UserPlusIcon className="w-5 h-5" />
                    アカウントを作成
                  </div>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Footer Links */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-4">
            <Link 
              href="/login" 
              className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
            >
              既にアカウントをお持ちの方はログイン
            </Link>
          </div>
          
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p className="mb-2">企業アカウントをお持ちの方のみご利用いただけます：</p>
            <div className="flex justify-center">
              <Badge variant="outline" className="text-xs">
                <BuildingIcon className="w-3 h-3 mr-1" />
                企業インタビューのみ
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
