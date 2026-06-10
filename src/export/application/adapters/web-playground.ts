import type { PlaygroundPort } from '../ports'

/**
 * Web adapter for {@link PlaygroundPort}: opens the share URL in a new tab.
 */
export const webPlaygroundPort: PlaygroundPort = {
  async open(url) {
    window.open(url, '_blank')
  }
}
