import { Trans } from '@lingui/react/macro'
import Button from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import { isDevelopment } from '@/core'
import styles from './error-boundary.module.css'

export type ErrorFallbackProps = {
  error: Error | null
  onReset: () => void
}

/**
 * User-facing recovery UI rendered when a render-time error is caught by
 * {@link ErrorBoundary}. Kept as a function component so it can use hooks
 * (Lingui) — the class boundary itself cannot.
 */
export function ErrorFallback({ error, onReset }: ErrorFallbackProps) {
  return (
    <div className={styles.container} role='alert'>
      <div className={styles.card}>
        <Icon name='ExclamationTriangleIcon' className={styles.icon} />
        <h2 className={styles.title}>
          <Trans>Une erreur inattendue s'est produite</Trans>
        </h2>
        <p className={styles.message}>
          <Trans>
            L'application a rencontré un problème. Vous pouvez réessayer ; si le
            problème persiste, rechargez la page.
          </Trans>
        </p>

        {isDevelopment() && error && (
          <pre className={styles.details}>
            {error.message}
            {error.stack ? `\n\n${error.stack}` : ''}
          </pre>
        )}

        <div className={styles.actions}>
          <Button variant='primary' onClick={onReset}>
            <Trans>Réessayer</Trans>
          </Button>
          <Button
            variant='secondary'
            onClick={() => globalThis.location.reload()}
          >
            <Trans>Recharger la page</Trans>
          </Button>
        </div>
      </div>
    </div>
  )
}
