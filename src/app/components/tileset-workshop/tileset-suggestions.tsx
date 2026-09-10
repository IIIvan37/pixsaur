/**
 * Tile sizes the workshop puts forward, best first, each with what it costs.
 *
 * A preselection the user arbitrates, not a verdict — clicking one adopts it.
 * The geometry ranks on distortion (Q1 · Q7), the grid on the tilemap it would
 * weigh (Q29); the list itself does not care which.
 */

import type { ReactNode } from 'react'
import Button from '@/components/ui/button'
import type { TileGrid } from '@/libs/pixsaur-tileset'
import styles from './tileset-workshop.module.css'

export interface TileSuggestion {
  size: TileGrid
  /** What that size costs, read beside it. */
  note: ReactNode
}

export interface TileSuggestionsProps {
  title: ReactNode
  suggestions: readonly TileSuggestion[]
  onPick: (size: TileGrid) => void
}

export function TileSuggestions({
  title,
  suggestions,
  onPick
}: Readonly<TileSuggestionsProps>) {
  return (
    <section className={styles.suggestions}>
      <h2 className={styles.subtitle}>{title}</h2>
      <ul className={styles.candidates}>
        {suggestions.map(({ size, note }) => (
          <li key={`${size.tileWidth}x${size.tileHeight}`}>
            <Button variant='secondary' onClick={() => onPick(size)}>
              {`${size.tileWidth} x ${size.tileHeight}`}
            </Button>
            <span>{note}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
