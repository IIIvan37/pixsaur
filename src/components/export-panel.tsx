import styles from '@/styles/image-converter.module.css'
import animStyles from '@/styles/animations.module.css'
import Icon from './ui/icon'
import { Button } from '@radix-ui/themes'
import { previewImageAtom } from '@/app/store/preview/preview'
import { useAtomValue } from 'jotai'
export default function ExportPanel() {
  const image = useAtomValue(previewImageAtom)

  const onExport = () => {
    if (!image?.data) return
    const canvas = document.createElement('canvas')

    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    ctx?.putImageData(image, 0, 0)
    const link = document.createElement('a')
    link.download = 'image.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
  }
  return (
    <div className={styles.exportPanel}>
      <Button
        onClick={onExport}
        disabled={!image?.data}
        className={[animStyles.button, styles.exportButton].join(' ')}
        aria-disabled={!image?.data}
      >
        <Icon name='DownloadIcon' className={styles.buttonIcon} />
        Exporter en PNG
      </Button>
    </div>
  )
}
