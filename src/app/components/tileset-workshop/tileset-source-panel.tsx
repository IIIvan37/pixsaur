import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback } from 'react'
import {
  setTilesetSheetAtom,
  tilesetSheetAtom
} from '@/app/store/tileset/tileset'
import { ImageUpload } from '@/components/image-upload/image-upload'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { sheetFromImage } from './sheet-from-image'

/** Where the sheet comes in — the only input the workshop takes (Q5). */
export function TilesetSourcePanel() {
  const sheet = useAtomValue(tilesetSheetAtom)
  const setSheet = useSetAtom(setTilesetSheetAtom)

  const handleLoaded = useCallback(
    (img: HTMLImageElement) => setSheet(sheetFromImage(img)),
    [setSheet]
  )

  return (
    <Panel>
      <Header
        title={<Trans>Planche source</Trans>}
        actionLabel={sheet ? <Trans>Changer de planche</Trans> : undefined}
        action={sheet ? () => setSheet(null) : undefined}
      />
      {sheet ? (
        <p>
          <Trans>Dimensions</Trans>
          {' : '}
          <span>{`${sheet.width} x ${sheet.height} px`}</span>
        </p>
      ) : (
        <ImageUpload onImageLoaded={handleLoaded} />
      )}
    </Panel>
  )
}
