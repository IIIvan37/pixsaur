/**
 * Ports for the editor feature (clean-archi strangler-fig).
 *
 * A port is an interface for an impure side-effect a use-case needs. Real
 * adapters are injected at the edges so the orchestration code stays pure and
 * testable with fakes.
 *
 * Living registry: see `./README.md`.
 */

/**
 * Source of wall-clock time, used to stamp edit-history entries.
 *
 * The runtime adapter is `Date.now()`. Injecting it as a port keeps
 * `paintPixels` pure and lets tests assert on deterministic timestamps.
 */
export interface Clock {
  /** Current epoch time in milliseconds. */
  now(): number
}
