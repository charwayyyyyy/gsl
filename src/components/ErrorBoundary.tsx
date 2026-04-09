import React from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = {
  children: React.ReactNode
}

type State = {
  hasError: boolean
  message?: string
  isChunkLoadError?: boolean
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, isChunkLoadError: false }
  }
  static getDerivedStateFromError(error: any) {
    const message = String(error?.message || error)
    // Check if it's a dynamic import failure
    const isChunkLoadError = /Failed to fetch dynamically imported module|Loading chunk \d+ failed/.test(message)
    return { hasError: true, message, isChunkLoadError }
  }
  componentDidCatch(error: any, info: any) {
    // If it's a chunk load error, we can automatically reload once
    const message = String(error?.message || error)
    if (/Failed to fetch dynamically imported module|Loading chunk \d+ failed/.test(message)) {
      const hasReloaded = sessionStorage.getItem('chunk_error_reload')
      if (!hasReloaded) {
        sessionStorage.setItem('chunk_error_reload', 'true')
        window.location.reload()
      }
    }
  }
  handleReset = () => {
    if (this.state.isChunkLoadError) {
      sessionStorage.setItem('chunk_error_reload', 'true')
      window.location.reload()
    } else {
      this.setState({ hasError: false, message: undefined, isChunkLoadError: false })
    }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6">
          <div className="glass-card max-w-md w-full p-8 text-center animate-fade-in">
            <div className="w-20 h-20 bg-red-500/10 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-glass border border-red-500/20">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Something went wrong</h2>
            <p className="text-slate-600 dark:text-slate-400 mb-8 leading-relaxed">
              {this.state.message || "An unexpected error occurred. Please try again."}
            </p>
            <button
              onClick={this.handleReset}
              className="ios-button-primary w-full"
            >
              Retry Session
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

