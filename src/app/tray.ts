// Tray fallback removed — intentionally empty. Keep this as a no-op
// so older builds that dynamically import the function do not fail.
export async function createSystemTray(): Promise<void> {
  // No-op: tray intentionally removed.
  return Promise.resolve()
}

export default createSystemTray
