import ImageConverter from '@/app/components/image-converter'

import styles from '@/styles/app.module.css'
import '@/styles/variables.css'

export default function App() {
  return (
    <main className={styles.container}>
      <div className={styles.content}>
        <header className={styles.header}>
          <h1 className={styles.title}>PIXSAUR</h1>
          <p className={styles.subtitle}>Convertisseur d'images Amstrad CPC"</p>
          <div className={styles.langSwitcher}>
            {/* <LanguageSwitcher /> */}
          </div>
        </header>

        <ImageConverter />

        <footer className={styles.footer}></footer>
      </div>
    </main>
  )
}
