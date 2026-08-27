import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue } from 'jotai'
import { useEffect, useState } from 'react'
import { effectiveModeConfigAtom } from '@/app/store/config/config'
import { rasterEnabledAtom } from '@/app/store/raster/raster'
import Button from '@/components/ui/button'
import Checkbox from '@/components/ui/checkbox/checkbox'
import PixsaurDialog from '@/components/ui/dialog/dialog'
import Input from '@/components/ui/input/input'
import { screenCapability } from '@/domain/cpc'
import type { ExportConfig } from '@/export'
import { DEFAULT_EXPORT_CONFIG } from '@/export'
import styles from './export-config-dialog.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (config: ExportConfig) => void
}

export default function ExportConfigDialog({
  open,
  onOpenChange,
  onConfirm
}: Readonly<Props>) {
  const { _ } = useLingui()
  const [config, setConfig] = useState<ExportConfig>(DEFAULT_EXPORT_CONFIG)
  const modeConfig = useAtomValue(effectiveModeConfigAtom)
  const rasterEnabled = useAtomValue(rasterEnabledAtom)

  // What this screen can produce — the same rule the exporters read.
  const { canExportScr: canExportSCR, canExportSna: canExportSNA } =
    screenCapability(modeConfig)

  // Automatically uncheck SCR and SNA if export is not allowed
  useEffect(() => {
    const updates: Partial<ExportConfig['content']> = {}

    if (!canExportSCR && config.content.includeSCR) {
      updates.includeSCR = false
    }
    if (!canExportSNA && config.content.includeSNA) {
      updates.includeSNA = false
    }

    if (Object.keys(updates).length > 0) {
      setConfig((prev) => ({
        ...prev,
        content: { ...prev.content, ...updates }
      }))
    }
  }, [
    canExportSCR,
    canExportSNA,
    config.content.includeSCR,
    config.content.includeSNA
  ])

  const handleConfirm = () => {
    onConfirm(config)
    onOpenChange(false)
  }

  const updateContent = (
    key: keyof ExportConfig['content'],
    value: boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      content: { ...prev.content, [key]: value }
    }))
  }

  const updateLabels = (key: 'media' | 'palette' | 'raster', value: string) => {
    setConfig((prev) => ({
      ...prev,
      labels: { ...prev.labels, [key]: value }
    }))
  }

  const toggleLabelsEnabled = () => {
    setConfig((prev) => ({
      ...prev,
      labels: { ...prev.labels, enabled: !prev.labels.enabled }
    }))
  }

  const updateFilename = (value: string) => {
    setConfig((prev) => ({ ...prev, filename: value }))
  }

  return (
    <PixsaurDialog
      open={open}
      onOpenChange={onOpenChange}
      title={_(msg`Configuration de l'export`)}
      description={_(
        msg`Sélectionnez les fichiers à inclure dans l'archive ZIP`
      )}
      footer={
        <div className={styles.actions}>
          <Button onClick={() => onOpenChange(false)} variant='secondary'>
            <Trans>Annuler</Trans>
          </Button>
          <Button onClick={handleConfirm}>
            <Trans>Exporter</Trans>
          </Button>
        </div>
      }
    >
      <div className={styles.formGroup}>
        <div className={styles.label}>
          <Trans>Contenu du ZIP</Trans>
        </div>
        <div className={styles.checkboxGroup}>
          <Checkbox
            checked={config.content.includeSCR}
            onChange={(e) => updateContent('includeSCR', e.target.checked)}
            label={_(msg`SCR ASM (format CPC entrelacé)`)}
            disabled={!canExportSCR}
            title={
              canExportSCR
                ? undefined
                : _(
                    msg`Le format SCR nécessite des dimensions tenant dans 16 Ko de mémoire écran CPC (sans overscan)`
                  )
            }
          />
          <Checkbox
            checked={config.content.includeLinear}
            onChange={(e) => updateContent('includeLinear', e.target.checked)}
            label={_(msg`Linear ASM (séquentiel)`)}
          />
          <Checkbox
            checked={config.content.includePalettes}
            onChange={(e) => updateContent('includePalettes', e.target.checked)}
            label={_(msg`Palettes (firmware/hardware)`)}
          />
          <Checkbox
            checked={config.content.includeSNA}
            onChange={(e) => updateContent('includeSNA', e.target.checked)}
            label={_(msg`SNA (snapshot exécutable)`)}
            disabled={!canExportSNA}
            title={
              canExportSNA
                ? _(
                    msg`Génère un fichier snapshot (.SNA) avec le code d'affichage intégré`
                  )
                : _(
                    msg`Le format SNA n'est disponible que pour les tailles standard ou overscan`
                  )
            }
          />
          <Checkbox
            checked={config.content.includePNG}
            onChange={(e) => updateContent('includePNG', e.target.checked)}
            label={_(msg`PNG (pixels carrés)`)}
          />
          <Checkbox
            checked={config.content.includePNGCorrected}
            onChange={(e) =>
              updateContent('includePNGCorrected', e.target.checked)
            }
            label={_(msg`PNG (aspect ratio CPC correct)`)}
          />
          {rasterEnabled && (
            <Checkbox
              checked={config.content.includeRasters}
              onChange={(e) =>
                updateContent('includeRasters', e.target.checked)
              }
              label={_(msg`Rasters (données ASM)`)}
            />
          )}
        </div>
      </div>

      <div className={styles.formGroup}>
        <Checkbox
          checked={config.labels.enabled}
          onChange={toggleLabelsEnabled}
          label={_(msg`Utiliser des labels personnalisés`)}
        />
      </div>

      {config.labels.enabled && (
        <>
          <Input
            label={_(msg`Label des données`)}
            type='text'
            value={config.labels.media}
            onChange={(e) => updateLabels('media', e.target.value)}
            placeholder='ImageData'
          />

          <Input
            label={_(msg`Label de la palette`)}
            type='text'
            value={config.labels.palette}
            onChange={(e) => updateLabels('palette', e.target.value)}
            placeholder='Palette'
          />
        </>
      )}

      <Input
        label={_(msg`Nom du fichier ZIP`)}
        type='text'
        value={config.filename}
        onChange={(e) => updateFilename(e.target.value)}
        placeholder='pixsaur_export'
      />
    </PixsaurDialog>
  )
}
