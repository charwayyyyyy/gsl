import { useState, useEffect } from 'react'

export const useSystemHealth = () => {
  const [isHealthy, setIsHealthy] = useState<boolean>(true)
  const [isLoading, setIsLoading] = useState<boolean>(true)

  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch('http://localhost:8000/health')
        if (res.ok) {
          setIsHealthy(true)
        } else {
          setIsHealthy(false)
        }
      } catch (e) {
        setIsHealthy(false)
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

  return { isHealthy, isLoading }
}
