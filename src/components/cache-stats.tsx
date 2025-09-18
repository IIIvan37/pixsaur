import { useAtomValue } from 'jotai'
import { atom } from 'jotai'
import { getDitheringCacheStats } from '@/app/store/preview/preview'

// Atom pour forcer la mise à jour des stats du cache
const cacheStatsRefreshAtom = atom(0)

export const cacheStatsAtom = atom((get) => {
  get(cacheStatsRefreshAtom) // Force refresh
  return getDitheringCacheStats()
})

export const refreshCacheStatsAtom = atom(null, (get, set) => {
  const current = get(cacheStatsRefreshAtom)
  set(cacheStatsRefreshAtom, current + 1)
})

export function CacheStats() {
  const stats = useAtomValue(cacheStatsAtom)
  
  return (
    <div style={{ 
      position: 'fixed', 
      top: '10px', 
      right: '10px', 
      background: 'rgba(0,0,0,0.8)', 
      color: 'white', 
      padding: '8px 12px', 
      borderRadius: '6px',
      fontSize: '12px',
      fontFamily: 'monospace',
      zIndex: 1000
    }}>
      <div>🗄️ Cache: {stats.size}/{stats.maxSize}</div>
      <div>📊 Hit Rate: {(stats.hitRate * 100).toFixed(1)}%</div>
      <div>✅ Hits: {stats.hits} | ❌ Misses: {stats.misses}</div>
    </div>
  )
}