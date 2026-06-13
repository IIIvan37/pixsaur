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
import { Notification } from '@/components/ui/notification/notification'

type Translate = ReturnType<typeof useLingui>['_']

function toastMessage(_: Translate, kind: ToastKind): string {
  switch (kind) {
    case 'gpu-fallback':
      return _(
        msg`Accélération GPU indisponible — basculement sur le processeur CPU (plus lent).`
      )
    default:
      return ''
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
      type='info'
      open={toast.open}
      onOpenChange={(open) => {
        if (!open) dismiss()
      }}
      autoCloseDuration={5000}
    />
  )
}
