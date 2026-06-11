/**
 * Ports for the raster feature (clean-archi strangler-fig).
 *
 * A port is an interface for an impure side-effect a use-case needs. Real
 * adapters are injected at the edges so the orchestration code stays pure and
 * testable with fakes.
 *
 * Living registry: see `./README.md`.
 */

/**
 * Produces unique identifiers for newly created raster changes.
 *
 * The runtime adapter is the store's `generateChangeId`
 * (`app/store/raster/raster-changes.ts`), which is non-deterministic
 * (`Date.now()` + `Math.random()`). Injecting it as a port keeps
 * `optimizeRaster` pure and lets tests assert on stable IDs.
 */
export interface IdGenerator {
  /** Return a fresh, unique id. */
  generate(): string
}
