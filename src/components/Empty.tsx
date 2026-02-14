import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function Empty() {
  return (
    <div className={cn('flex flex-col items-center justify-center h-full p-8 text-center animate-fade-in')}>
      <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-3xl flex items-center justify-center mb-6 shadow-glass border border-white/10">
        <Search className="w-10 h-10 text-slate-400" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">No results found</h3>
      <p className="text-slate-500 dark:text-slate-400 max-w-xs">
        Try adjusting your search or filters to find what you're looking for.
      </p>
    </div>
  )
}
