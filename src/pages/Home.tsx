import { useNavigate } from 'react-router-dom'
import DirectionSelection from '@/components/DirectionSelection'
import { useAppStore } from '@/stores/appStore'

export default function Home() {
  const navigate = useNavigate()
  const { startTranslationSession, toggleAccessibilityPanel } = useAppStore.getState()

  const handleDirectionSelect = (direction: 'sign_to_speech' | 'speech_to_sign') => {
    startTranslationSession(direction)
    navigate('/interpreter')
  }

  return (
    <DirectionSelection onDirectionSelect={handleDirectionSelect} />
  )
}
