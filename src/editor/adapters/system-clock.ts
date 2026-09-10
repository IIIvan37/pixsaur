/**
 * The runtime `Clock`: the machine's own wall clock.
 *
 * Every consumer that is not a test uses this one. Tests hand `paintPixels`
 * and its kin a fake instead, which is the whole point of the port.
 */

import type { Clock } from '../application/ports'

export const systemClock: Clock = { now: () => Date.now() }
