import { Component, type ErrorInfo, type ReactNode } from 'react'
import { logger } from '@/core'
import { ErrorFallback } from './error-fallback'

export type ErrorBoundaryProps = {
  children: ReactNode
}

type ErrorBoundaryState = {
  error: Error | null
}

/**
 * Top-level error boundary. Catches render-time errors anywhere below it and
 * swaps the tree for a recoverable {@link ErrorFallback} instead of letting the
 * whole app unmount to a blank screen.
 *
 * React error boundaries must be class components, so the localized recovery UI
 * lives in {@link ErrorFallback} (a function component that can use hooks).
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logger.error('[ErrorBoundary] Uncaught render error:', error, info)
  }

  handleReset = () => {
    this.setState({ error: null })
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback error={this.state.error} onReset={this.handleReset} />
      )
    }

    return this.props.children
  }
}
