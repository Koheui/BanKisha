import { ArrowUp, ArrowDown, Minus } from 'lucide-react'

export const MarketSummary = () => {
  return (
    <div className="bg-gray-50 dark:bg-[#151b2d] rounded-lg p-5 border border-gray-100 dark:border-gray-800">
      <h4 className="text-sm font-bold text-muted-light dark:text-muted-dark uppercase mb-3">主要指数</h4>
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="font-bold text-sm">日経平均</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">38,520.15</span>
            <span className="flex items-center text-xs font-bold text-green-600">
              <ArrowUp className="w-3 h-3 mr-1" />
              1.2%
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-bold text-sm">ダウ平均</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">39,087.33</span>
            <span className="flex items-center text-xs font-bold text-red-600">
              <ArrowDown className="w-3 h-3 mr-1" />
              0.4%
            </span>
          </div>
        </div>
        <div className="flex justify-between items-center">
          <span className="font-bold text-sm">ドル/円</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono">150.24</span>
            <span className="flex items-center text-xs font-bold text-gray-500">
              <Minus className="w-3 h-3 mr-1" />
              0.0%
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
