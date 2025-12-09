import PreviewPanel from '@/app/components/preview-panel'
import SourceSection from '@/app/components/source-section'
import { SettingsButton } from '@/components/settings-panel/settings-button'
import styles from './main-content.module.css'

export default function MainContent() {
  return (
    <div className={styles.content}>
      {/* Settings button */}
      <div className={styles.settingsButtonContainer}>
        <SettingsButton />
      </div>

      {/* Two columns side by side */}
      <div className={styles.flexRow}>
        {/* Left side: Source Image */}
        <div className={styles.flexColumnGrow}>
          <SourceSection />
        </div>

        {/* Right side: Preview and Palette */}
        <div className={styles.flexColumnGrow}>
          <PreviewPanel />
        </div>
      </div>
    </div>
  )
}
