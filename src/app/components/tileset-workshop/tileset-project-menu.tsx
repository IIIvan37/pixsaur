import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { Trans } from '@lingui/react/macro'
import { useAtom, useAtomValue, useSetAtom } from 'jotai'
import { useCallback, useRef, useState } from 'react'
import {
  captureTilesetProjectAtom,
  restoreTilesetProjectAtom,
  setTilesetSheetAtom,
  tilesetProjectNoticeAtom,
  tilesetSheetAtom
} from '@/app/store/tileset/tileset'
import Button from '@/components/ui/button'
import Icon from '@/components/ui/icon'
import Popover from '@/components/ui/popover'
import { logger } from '@/core'
import { resolveFileSink } from '@/export/application/file-sink'
import { exportTilesetProjectFile, importTilesetProjectFile } from '@/tileset'
import styles from './tileset-workshop.module.css'

const REFUSALS = {
  'unreadable-file': msg`Ce fichier ne se laisse pas lire.`,
  'invalid-json': msg`Ce fichier n'est pas un projet d'atelier.`,
  'unsupported-version': msg`Ce projet vient d'une autre version de l'atelier.`,
  malformed: msg`Ce projet est incomplet : la planche ne se relit pas.`
}

const NOTICES = {
  'tile-dither-dropped': msg`Ce projet réglait le tramage tuile par tuile. Ce réglage n'existe plus : toute la planche suit le tramage de la section Rendu.`
}

/**
 * « Projet ▾ » in the workshop bar (Q31 · S-Q8 · S-Q10): the project as a
 * file the user owns, and the way back to another image.
 *
 * The workshop already remembers itself in the browser; the project file is
 * the copy that survives a cleared cache, another machine, or a hand-off. All
 * three actions are taken a few times a session, so they fold into one menu.
 *
 * Both directions are `@/tileset` use-cases; this menu assembles the input,
 * injects the sink of the day, and says what a refusal was — or what the
 * migration of an older project changed, whichever carrier it came from.
 */
export function TilesetProjectMenu() {
  const { _ } = useLingui()
  const project = useAtomValue(captureTilesetProjectAtom)
  const sheet = useAtomValue(tilesetSheetAtom)
  const restore = useSetAtom(restoreTilesetProjectAtom)
  const setSheet = useSetAtom(setTilesetSheetAtom)
  const [open, setOpen] = useState(false)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [notice, setNotice] = useAtom(tilesetProjectNoticeAtom)
  const importInput = useRef<HTMLInputElement>(null)

  const handleExport = useCallback(async () => {
    setOpen(false)
    if (!project) return

    const saved = await exportTilesetProjectFile(
      { project },
      { fileSink: resolveFileSink() }
    )
    if (!saved.ok) {
      logger.error('[TILESET] Failed to save the project:', saved.error)
    }
  }, [project])

  const handleImport = useCallback(
    async (file: File) => {
      const parsed = await importTilesetProjectFile({ file })
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
    <>
      <Popover
        open={open}
        onOpenChange={setOpen}
        side='bottom'
        align='end'
        trigger={
          <Button variant='secondary'>
            <span>
              <Trans>Projet</Trans>
            </span>
            <Icon name='ChevronDownIcon' />
          </Button>
        }
      >
        <div className={styles.menu}>
          <Button
            variant='secondary'
            disabled={!project}
            onClick={() => void handleExport()}
          >
            <Trans>Exporter le projet</Trans>
          </Button>
          <Button
            variant='secondary'
            onClick={() => {
              setOpen(false)
              importInput.current?.click()
            }}
          >
            <Trans>Importer un projet</Trans>
          </Button>
          <Button
            variant='secondary'
            disabled={!sheet}
            onClick={() => {
              setOpen(false)
              setSheet(null)
            }}
          >
            <Trans>Changer d'image</Trans>
          </Button>
        </div>
      </Popover>

      {/* Outside the menu, which unmounts as it closes: the input has to
          outlive it to hear the file the picker hands back. */}
      <input
        ref={importInput}
        className={styles.fileInput}
        type='file'
        accept='application/json,.json'
        aria-label={_(msg`Importer un projet`)}
        tabIndex={-1}
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void handleImport(file)
          // Cleared so re-picking the same file still fires a change.
          event.target.value = ''
        }}
      />

      {refusal && (
        <p className={styles.refusal} role='alert'>
          {refusal}
        </p>
      )}

      {notice && (
        <output className={styles.notice}>
          <p>{_(NOTICES[notice])}</p>
          <Button variant='secondary' onClick={() => setNotice(null)}>
            <Trans>Compris</Trans>
          </Button>
        </output>
      )}
    </>
  )
}
