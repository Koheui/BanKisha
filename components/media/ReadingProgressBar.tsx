'use client'

import { useState, useEffect } from 'react'

export const ReadingProgressBar = () => {
  const [width, setWidth] = useState(0)

  const handleScroll = () => {
    const totalHeight = document.documentElement.scrollHeight - document.documentElement.clientHeight
    const scrollPosition = window.scrollY
    const scrollPercentage = (scrollPosition / totalHeight) * 100
    setWidth(scrollPercentage)
  }

  useEffect(() => {
    window.addEventListener('scroll', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  return (
    <div className="fixed top-0 left-0 z-50 w-full h-1">
      <div
        className="h-1 bg-primary transition-all duration-75"
        style={{ width: `${width}%` }}
      />
    </div>
  )
}
