import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useId, useState } from 'react'
import {
  captureTilesetProjectAtom,
  restoreTilesetProjectAtom
} from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import { Header } from '@/components/ui/layout/header/header'
import { Panel } from '@/components/ui/layout/panel/panel'
import { logger } from '@/core'
import { resolveFileSink } from '@/export/application/file-sink'
import { parseTilesetProject, serializeTilesetProject } from '@/tileset'
import styles from './tileset-workshop.module.css'

const PROJECT_FILENAME = 'tileset-project.json'

const REFUSALS = {
  'invalid-json': msg`Ce fichier n'est pas un projet d'atelier.`,
  'unsupported-version': msg`Ce projet vient d'une autre version de l'atelier.`,
  malformed: msg`Ce projet est incomplet : la planche ne se relit pas.`
}

/**
 * The project as a file the user owns (Q31).
 *
 * The workshop already remembers itself in the browser; this is the copy that
 * survives a cleared cache, another machine, or a hand-off — and the only one
 * the user can put somewhere they trust.
 */
export function TilesetProjectPanel() {
  const { _ } = useLingui()
  const project = useAtomValue(captureTilesetProjectAtom)
  const restore = useSetAtom(restoreTilesetProjectAtom)
  const [refusal, setRefusal] = useState<string | null>(null)
  const importId = useId()

  const handleImport = useCallback(
    async (file: File) => {
      const parsed = parseTilesetProject(await file.text())
      if (!parsed.ok) {
        setRefusal(_(REFUSALS[parsed.error]))
        return
      }
      setRefusal(null)
      restore(parsed.project)
    },
    [_, restore]
  )

  return (
    <Panel>
      <Header title={<Trans>Projet</Trans>} />

      <Button
        disabled={!project}
        onClick={() => {
          if (!project) return
          resolveFileSink()
            .save(
              new Blob([serializeTilesetProject(project)], {
                type: 'application/json'
              }),
              PROJECT_FILENAME
            )
            .catch((error) =>
              logger.error('[TILESET] Failed to save the project:', error)
            )
        }}
      >
        <Trans>Exporter le projet</Trans>
      </Button>

      {/* A plain file input rather than a drop zone: a project is picked once,
          and the same control serves the keyboard. */}
      <label className={styles.note} htmlFor={importId}>
        <Trans>Importer un projet</Trans>
      </label>
      <input
        id={importId}
        type='file'
        accept='application/json,.json'
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleImport(file)
          // Cleared so re-picking the same file still fires a change.
          event.target.value = ''
        }}
      />

      {refusal && <p role='alert'>{refusal}</p>}
    </Panel>
  )
}
