import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BuildingIcon, GlobeIcon, MapPinIcon } from 'lucide-react'
import type { Company } from '@/src/types'
import Link from 'next/link'

interface CompanyProfileProps {
  company: Company
}

export function CompanyProfile({ company }: CompanyProfileProps) {
  return (
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center gap-4">
          {company.logoUrl ? (
            <Image
              src={company.logoUrl}
              alt={company.name}
              width={80}
              height={80}
              className="rounded-lg"
            />
          ) : (
            <div className="w-20 h-20 bg-gradient-to-br from-blue-100 to-purple-100 dark:from-blue-900 dark:to-purple-900 rounded-lg flex items-center justify-center">
              <BuildingIcon className="w-10 h-10 text-blue-600 dark:text-blue-400" />
            </div>
          )}
          <div>
            <CardTitle className="text-2xl">{company.name}</CardTitle>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {(company as any).description && (
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              {(company as any).description}
            </p>
          )}
          <div className="flex flex-wrap gap-4 text-sm text-gray-600 dark:text-gray-400">
            {(company as any).website && (
              <Link
                href={(company as any).website}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
              >
                <GlobeIcon className="w-4 h-4" />
                <span>公式サイト</span>
              </Link>
            )}
            {(company as any).address && (
              <div className="flex items-center gap-2">
                <MapPinIcon className="w-4 h-4" />
                <span>{(company as any).address}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

