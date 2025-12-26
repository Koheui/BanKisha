'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getArticles, getCompanies } from '@/src/lib/firestore'
import type { Article, Company } from '@/src/types'
import { ArticleCard } from './ArticleCard'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { SearchIcon, LoaderIcon, FileTextIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle } from '@/components/ui/card'

interface ArticleWithCompany extends Article {
  company?: Company
}

export function SearchResults() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [articles, setArticles] = useState<ArticleWithCompany[]>([])
  const [filteredArticles, setFilteredArticles] = useState<ArticleWithCompany[]>([])
  const [loading, setLoading] = useState(false)
  const [searchHistory, setSearchHistory] = useState<string[]>([])

  useEffect(() => {
    // ローカルストレージから検索履歴を読み込み
    const history = localStorage.getItem('searchHistory')
    if (history) {
      try {
        setSearchHistory(JSON.parse(history))
      } catch (error) {
        console.error('Error parsing search history:', error)
      }
    }

    // 初期検索
    if (query) {
      performSearch(query)
    } else {
      loadAllArticles()
    }
  }, [])

  useEffect(() => {
    // URLパラメータが変更されたら検索を実行
    const urlQuery = searchParams.get('q') || ''
    if (urlQuery && urlQuery !== query) {
      setQuery(urlQuery)
      performSearch(urlQuery)
    }
  }, [searchParams])

  const loadAllArticles = async () => {
    try {
      setLoading(true)
      const [publicArticles, companies] = await Promise.all([
        getArticles('public'),
        getCompanies().catch(() => [] as Company[]),
      ])

      const articlesWithCompany = publicArticles.map((article) => {
        const company = companies.find((c) => c.id === article.companyId)
        return { ...article, company }
      })

      setArticles(articlesWithCompany)
      setFilteredArticles(articlesWithCompany)
    } catch (error) {
      console.error('Error loading articles:', error)
    } finally {
      setLoading(false)
    }
  }

  const performSearch = async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      loadAllArticles()
      return
    }

    try {
      setLoading(true)

      const [publicArticles, companies] = await Promise.all([
        getArticles('public'),
        getCompanies().catch(() => [] as Company[]),
      ])

      const articlesWithCompany = publicArticles.map((article) => {
        const company = companies.find((c) => c.id === article.companyId)
        return { ...article, company }
      })

      // 簡易的な全文検索（タイトル、リード、本文を検索）
      const lowerQuery = searchQuery.toLowerCase()
      const filtered = articlesWithCompany.filter((article) => {
        const title = article.draftArticle.title.toLowerCase()
        const lead = article.draftArticle.lead.toLowerCase()
        const summary = (article.summary || article.publicMeta?.summary || '').toLowerCase()
        const sections = article.draftArticle.sections
          .map((s) => `${s.heading} ${s.body}`.toLowerCase())
          .join(' ')

        return (
          title.includes(lowerQuery) ||
          lead.includes(lowerQuery) ||
          summary.includes(lowerQuery) ||
          sections.includes(lowerQuery)
        )
      })

      setArticles(articlesWithCompany)
      setFilteredArticles(filtered)

      // 検索履歴に追加
      if (searchQuery.trim()) {
        const newHistory = [
          searchQuery,
          ...searchHistory.filter((h) => h !== searchQuery),
        ].slice(0, 10) // 最新10件まで
        setSearchHistory(newHistory)
        localStorage.setItem('searchHistory', JSON.stringify(newHistory))
      }
    } catch (error) {
      console.error('Error performing search:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      router.push(`/media/search?q=${encodeURIComponent(query)}`)
      performSearch(query)
    }
  }

  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery)
    router.push(`/media/search?q=${encodeURIComponent(historyQuery)}`)
    performSearch(historyQuery)
  }

  return (
    <div>
      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-8">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="記事を検索..."
              className="pl-10"
            />
          </div>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <LoaderIcon className="w-4 h-4 animate-spin" />
            ) : (
              <SearchIcon className="w-4 h-4" />
            )}
            検索
          </Button>
        </div>
      </form>

      {/* Search History */}
      {searchHistory.length > 0 && !query && (
        <div className="mb-8">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            検索履歴
          </h2>
          <div className="flex flex-wrap gap-2">
            {searchHistory.map((historyQuery, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleHistoryClick(historyQuery)}
              >
                {historyQuery}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <LoaderIcon className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : filteredArticles.length === 0 ? (
        <Card>
          <CardHeader>
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileTextIcon className="w-8 h-8 text-gray-400" />
            </div>
            <CardTitle className="text-center">
              {query ? '検索結果が見つかりませんでした' : '記事がありません'}
            </CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
            {query && (
              <p>
                「{query}」の検索結果: {filteredArticles.length}件
              </p>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <ArticleCard key={article.id} article={article} company={article.company} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}


