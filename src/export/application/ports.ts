/**
 * Ports for the export feature (clean-archi strangler-fig).
 *
 * A port is an interface for an impure side-effect a use-case needs. Real
 * adapters are injected at the edges (web vs desktop) so the orchestration
 * code stays pure and testable with fakes.
 *
 * Living registry: see `./README.md`.
 */

/**
 * Opens a CPC Playground share URL in the user's environment.
 *
 * - Web adapter: `./adapters/web-playground.ts` (`window.open`).
 * - Desktop adapter: `@/tauri/playground.ts` (Tauri shell plugin).
 */
export interface PlaygroundPort {
  /** Open the given CPC Playground share URL. */
  open(url: string): Promise<void>
}
