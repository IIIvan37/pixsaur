import { useState } from 'react'
import { Notification } from '@/components/ui/notification/notification'
import ExportConfigDialog from './export-config-dialog'
import ExportPanelView from './export-panel-view'
import { useExportActions } from './use-export-actions'

export default function ExportPanel() {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const {
    canExport,
    playgroundLoading,
    handleExport,
    handleOpenInPlayground,
    notification
  } = useExportActions()

  return (
    <>
      <ExportPanelView
        onExport={() => setIsDialogOpen(true)}
        onOpenInPlayground={handleOpenInPlayground}
        disabled={isDialogOpen || !canExport}
        playgroundLoading={playgroundLoading}
      />
      <ExportConfigDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onConfirm={handleExport}
      />
      <Notification
        message={notification.message}
        type={notification.type}
        open={notification.open}
        onOpenChange={notification.onOpenChange}
        autoCloseDuration={3000}
      />
    </>
  )
}
