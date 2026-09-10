import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import {
  reduceTilesetSheetAtom,
  setTilesetSheetAtom,
  tilesetLayoutAtom,
  tilesetSheetAtom,
  tilesetSheetInspectionAtom
} from '@/app/store/tileset/tileset'
import { ImageUpload } from '@/components/image-upload/image-upload'
import Button from '@/components/ui/button'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { sheetFromImage } from './sheet-from-image'

/** Where the sheet comes in — the only input the workshop takes (Q5). */
export function TilesetSourcePanel() {
  const sheet = useAtomValue(tilesetSheetAtom)
  const setSheet = useSetAtom(setTilesetSheetAtom)
  const layout = useAtomValue(tilesetLayoutAtom)
  const inspection = useAtomValue(tilesetSheetInspectionAtom)
  const reduce = useSetAtom(reduceTilesetSheetAtom)

  const handleLoaded = useCallback(
    (img: HTMLImageElement) => setSheet(sheetFromImage(img)),
    [setSheet]
  )

  return (
    <Panel>
      <Header
        title={
          layout === 'map' ? (
            <Trans>Map source</Trans>
          ) : (
            <Trans>Planche source</Trans>
          )
        }
        actionLabel={sheet ? <Trans>Changer de planche</Trans> : undefined}
        action={sheet ? () => setSheet(null) : undefined}
      />
      {sheet ? (
        <>
          <p>
            <Trans>Dimensions</Trans>
            {' : '}
            <span>{`${sheet.width} x ${sheet.height} px`}</span>
          </p>
          {inspection?.scale && (
            <>
              <output>
                {/* The factor stays outside the messages: the Lingui macro
                    drops the values of an interpolated one here. */}
                <Trans>Image agrandie</Trans>
                {` ×${inspection.scale.factor} `}
                <Trans>détectée.</Trans>
              </output>
              <Button variant='secondary' onClick={() => reduce()}>
                <Trans>Réduire à la taille d'origine</Trans>
              </Button>
            </>
          )}
          {inspection?.filtered && (
            <p role='alert'>
              <Trans>
                L'image porte trop de couleurs : elle semble filtrée ou
                compressée. L'extraction exacte des tuiles peut échouer.
              </Trans>
            </p>
          )}
        </>
      ) : (
        <ImageUpload onImageLoaded={handleLoaded} />
      )}
    </Panel>
  )
}
