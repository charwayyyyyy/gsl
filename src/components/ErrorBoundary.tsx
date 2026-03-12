import React from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = {
  children: React.ReactNode
}

type State = {
  hasError: boolean
  message?: string
}

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, message: String(error?.message || error) }
  }
  componentDidCatch(error: any, info: any) {}
  handleReset = () => {
    this.setState({ hasError: false, message: undefined })
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

