/**
 * The workshop switcher (Q6).
 *
 * It replaces the whole content rather than adding a view: the tileset has no
 * use for rasters, Mode R, EGX, screen dimensions or crop, and greying those
 * out would be more puzzling than not showing them.
 */

import { Trans } from '@lingui/react/macro'
import { useAtom } from 'jotai'
import { ErrorBoundary } from '@/components/error-boundary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  activeWorkshopAtom,
  type Workshop
} from '../../store/workshop/workshop'
import ImageConverter from '../image-converter/image-converter'
import TilesetWorkshop from '../tileset-workshop/tileset-workshop'
import styles from './workshop-tabs.module.css'

export default function WorkshopTabs() {
  const [workshop, setWorkshop] = useAtom(activeWorkshopAtom)

  return (
    <Tabs
      value={workshop}
      onValueChange={(value) => setWorkshop(value as Workshop)}
      className={styles.tabs}
    >
      <TabsList aria-label='Atelier'>
        <TabsTrigger value='image'>
          <Trans>Image</Trans>
        </TabsTrigger>
        <TabsTrigger value='tileset'>
          <Trans>Tileset</Trans>
        </TabsTrigger>
      </TabsList>

      <TabsContent value='image'>
        <ErrorBoundary>
          <ImageConverter />
        </ErrorBoundary>
      </TabsContent>

      <TabsContent value='tileset'>
        <ErrorBoundary>
          <TilesetWorkshop />
        </ErrorBoundary>
      </TabsContent>
    </Tabs>
  )
}
