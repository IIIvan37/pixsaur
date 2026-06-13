import PreviewPanel from '@/app/components/preview-panel'
import SourceSection from '@/app/components/source-section'
import ExportPanel from '@/components/export-panel/export-panel'
import { InfoBar } from '@/components/info-bar'
import { SettingsButton } from '@/components/settings-panel/settings-button'
import { SettingsPanel } from '@/components/settings-panel/settings-panel'
import styles from './main-content.module.css'

export default function MainContent() {
  return (
    <div className={styles.content}>
      {/* Top action bar: settings toggle, primary export action, live info */}
      <div className={styles.settingsButtonContainer}>
        <SettingsButton />
        <ExportPanel />
        <InfoBar />
      </div>

      {/* Workspace: docked settings panel + source + preview */}
      <div className={styles.flexRow}>
        <SettingsPanel />

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
