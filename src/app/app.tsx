import ImageConverter from '@/app/components/image-converter'

import I18nProvider from '@/components/i18n-provider'
import { Trans } from '@lingui/react'
import styles from '@/styles/app.module.css'
import '@/styles/variables.css'

export default function App() {
  return (
    <I18nProvider>
      <main className={styles.container}>
        <div className={styles.content}>
          <header className={styles.header}>
            <h1 className={styles.title}>PIXSAUR</h1>
            <p className={styles.subtitle}>
              <Trans
                id="Convertisseur d'images Amstrad CPC"
                message="Convertisseur d'images Amstrad CPC"
              />
            </p>
            <div className={styles.langSwitcher}>
              {/* <LanguageSwitcher /> */}
            </div>
          </header>

          <ImageConverter />

          <footer className={styles.footer}></footer>
        </div>
      </main>
    </I18nProvider>
  )
}
