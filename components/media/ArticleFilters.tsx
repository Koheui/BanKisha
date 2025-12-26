'use client'

import { useState, useEffect } from 'react'
import { getArticles, getCompanies } from '@/src/lib/firestore'
import type { Article, Company } from '@/src/types'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarIcon, BuildingIcon, TagIcon, ArrowUpDown } from 'lucide-react'

interface ArticleFiltersProps {
  articles: Article[]
  onFiltered: (articles: Article[]) => void
}

export function ArticleFilters({ articles, onFiltered }: ArticleFiltersProps) {
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [companyFilter, setCompanyFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest')
  const [companies, setCompanies] = useState<Company[]>([])

  useEffect(() => {
    loadCompanies()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [categoryFilter, companyFilter, dateFilter, sortBy, articles])

  const loadCompanies = async () => {
    try {
      const companiesData = await getCompanies()
      setCompanies(companiesData)
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  const applyFilters = () => {
    let filtered = [...articles]

    // カテゴリフィルタ
    if (categoryFilter !== 'all') {
      filtered = filtered.filter((article) => article.category === categoryFilter)
    }

    // 企業フィルタ
    if (companyFilter !== 'all') {
      filtered = filtered.filter((article) => article.companyId === companyFilter)
    }

    // 日付フィルタ
    if (dateFilter !== 'all') {
      const now = new Date()
      const filterDate = new Date()

      if (dateFilter === 'week') {
        filterDate.setDate(now.getDate() - 7)
      } else if (dateFilter === 'month') {
        filterDate.setMonth(now.getMonth() - 1)
      } else if (dateFilter === 'year') {
        filterDate.setFullYear(now.getFullYear() - 1)
      }

      filtered = filtered.filter((article) => {
        const publishedAt = article.publishedAt ||
          article.publicMeta?.publishedAt ||
          article.createdAt
        return publishedAt >= filterDate
      })
    }

    // ソート
    filtered.sort((a, b) => {
      const dateA = a.publishedAt || a.publicMeta?.publishedAt || a.createdAt
      const dateB = b.publishedAt || b.publicMeta?.publishedAt || b.createdAt

      if (sortBy === 'newest') {
        return dateB.getTime() - dateA.getTime()
      } else {
        return dateA.getTime() - dateB.getTime()
      }
    })

    onFiltered(filtered)
  }

  // ユニークなカテゴリを取得
  const categories = Array.from(new Set(articles.map((a) => a.category).filter((c): c is string => !!c)))

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-8 border border-gray-200 dark:border-gray-700">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* カテゴリフィルタ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <TagIcon className="w-4 h-4 inline mr-1" />
            カテゴリ
          </label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 企業フィルタ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <BuildingIcon className="w-4 h-4 inline mr-1" />
            企業
          </label>
          <Select value={companyFilter} onValueChange={setCompanyFilter}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              {companies.map((company) => (
                <SelectItem key={company.id} value={company.id}>
                  {company.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 日付フィルタ */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <CalendarIcon className="w-4 h-4 inline mr-1" />
            期間
          </label>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger>
              <SelectValue placeholder="すべて" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">すべて</SelectItem>
              <SelectItem value="week">今週</SelectItem>
              <SelectItem value="month">今月</SelectItem>
              <SelectItem value="year">今年</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ソート */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <ArrowUpDown className="w-4 h-4 inline mr-1" />
            並び順
          </label>
          <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'newest' | 'oldest')}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">新着順</SelectItem>
              <SelectItem value="oldest">古い順</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}

