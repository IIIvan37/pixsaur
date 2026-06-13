/**
 * App-wide toaster — renders cross-cutting notifications driven by
 * `toastAtom` (e.g. the GPU→CPU processor fallback). Feature-local feedback
 * (export results, updater) keeps its own inline notifications.
 */

import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react'
import { useAtomValue, useSetAtom } from 'jotai'
import {
  dismissToastAtom,
  type ToastKind,
  toastAtom
} from '@/app/store/notifications/toast'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_IMAGE_DIMENSION
} from '@/components/image-upload/validate-image-file'
import { Notification } from '@/components/ui/notification/notification'

type Translate = ReturnType<typeof useLingui>['_']
type NotificationType = 'success' | 'error' | 'info'

const MAX_FILE_SIZE_MB = Math.round(MAX_FILE_SIZE_BYTES / (1024 * 1024))

function toastMessage(_: Translate, kind: ToastKind): string {
  switch (kind) {
    case 'gpu-fallback':
      return _(
        msg`Accélération GPU indisponible — basculement sur le processeur CPU (plus lent).`
      )
    case 'image-too-large':
      return _(
        msg`Image trop volumineuse (maximum ${MAX_FILE_SIZE_MB} Mo). Veuillez choisir un fichier plus petit.`
      )
    case 'image-dimensions-too-large':
      return _(
        msg`Image trop grande (maximum ${MAX_IMAGE_DIMENSION}×${MAX_IMAGE_DIMENSION} px). Veuillez réduire ses dimensions.`
      )
    default:
      return ''
  }
}

function toastType(kind: ToastKind): NotificationType {
  switch (kind) {
    case 'image-too-large':
    case 'image-dimensions-too-large':
      return 'error'
    default:
      return 'info'
  }
}

export function Toaster() {
  const { _ } = useLingui()
  const toast = useAtomValue(toastAtom)
  const dismiss = useSetAtom(dismissToastAtom)

  if (!toast) return null

  return (
    <Notification
      message={toastMessage(_, toast.kind)}
      type={toastType(toast.kind)}
      open={toast.open}
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
      autoCloseDuration={5000}
    />
  )
}
