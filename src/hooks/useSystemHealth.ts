import { useState, useEffect } from 'react'
import { API_BASE_URL } from '@/config'

export const useSystemHealth = () => {
  const [isHealthy, setIsHealthy] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [status, setStatus] = useState<'loading' | 'healthy' | 'unhealthy'>('loading')

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/health`)
        if (res.ok) {
          setIsHealthy(true)
          setStatus('healthy')
        } else {
          setIsHealthy(false)
          setStatus('unhealthy')
        }
      } catch (e) {
        setIsHealthy(false)
        setStatus('unhealthy')
        console.error('System health check failed:', e)
      } finally {
        setIsLoading(false)
      }
    }

    checkHealth()

    // Periodic check every 30 seconds
    const interval = setInterval(checkHealth, 30000)

    return () => clearInterval(interval)
  }, [])

  return { isHealthy, isLoading, status }
}
