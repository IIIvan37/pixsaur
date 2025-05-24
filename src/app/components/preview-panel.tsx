import styles from '@/styles/image-converter.module.css'
import { useAtomValue, useSetAtom } from 'jotai'
import { useEffect } from 'react'
import { setReducedPaletteAtom } from '../store/palette/palette'
import { reducedPaletteAtom } from '../store/preview/preview'

import { ColorPalette } from '@/components/color-palette/color-palette'
import ImageControls from '@/components/image-controls/image-controls'
import ImagePreview from '@/components/image-preview/image-preview'

import { Panel } from '@/components/ui/layout/panel/panel'

const PreviewPanel = () => {
  const reduced = useAtomValue(reducedPaletteAtom)
  const setReduced = useSetAtom(setReducedPaletteAtom)

  useEffect(() => {
    setReduced(reduced)
  }, [reduced, setReduced])

  return (
    <Panel>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Aperçu</h2>
      </div>
      <div style={{ width: '100%', padding: '1rem' }}>
        <ImagePreview />
      </div>
      {/* Color Palette below preview */}
      <div style={{ width: '100%', padding: '1rem' }}>
        <ColorPalette />
      </div>

      {/* Mode controls directly under palette */}
      <div style={{ width: '100%', padding: '1rem' }}>
        <ImageControls />
      </div>
    </Panel>
  )
}

PreviewPanel.whyDidYouRender = true
export default PreviewPanel
