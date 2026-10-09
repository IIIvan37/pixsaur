import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  excludeTilesetMergeAtom,
  tilesetMapAtom
} from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import styles from './tileset-workshop.module.css'

/** How many merges are worth reading before the list stops informing. */
const MERGES_SHOWN = 12

/**
 * The merges the threshold made, farthest first (M-Q14 · M-Q15), in the
 * inspector: a threshold preselects them, the user takes back the ones that
 * matter — a door, a trap.
 */
export function TilesetMergeList() {
  const map = useAtomValue(tilesetMapAtom)
  const exclude = useSetAtom(excludeTilesetMergeAtom)

  if (!map || map.merges.length === 0) return null

  return (
    <Panel>
      <Header title={<Trans>Fusions, les plus lointaines en tête</Trans>} />
      <ul className={styles.candidates}>
        {[...map.merges]
          .sort((a, b) => b.distance - a.distance)
          .slice(0, MERGES_SHOWN)
          .map((merge) => (
            <li key={`${merge.absorbed}:${merge.survivor}`}>
              {/* Cells numbered from 1, like the map's GIDs. */}
              <span>
                {`#${merge.absorbed + 1} → #${merge.survivor + 1} · `}
                <Trans>écart</Trans>
                {` ${Math.round(merge.distance)}`}
              </span>
              <Button variant='secondary' onClick={() => exclude(merge)}>
                <Trans>Garder à part</Trans>
              </Button>
            </li>
          ))}
      </ul>
    </Panel>
  )
}
