/**
 * Registers the jest-dom matchers (`toHaveAttribute`, `toBeInTheDocument`, ...) with
 * Vitest 5's assertion types.
 *
 * Vitest 5 changed `Assertion<T>` to `Assertion<R, T>` and stopped reading the global
 * `jest.Matchers` namespace, so neither of jest-dom 7's own declarations reaches
 * `expect()` any more. Augmenting `Matchers<R, T>` covers both `expect()` and the
 * asymmetric matchers. Remove this file once jest-dom ships Vitest 5 types.
 *
 * @see https://github.com/testing-library/jest-dom/issues/738
 */

import type { TestingLibraryMatchers } from "@testing-library/jest-dom/matchers"

declare module "vitest" {
  interface Matchers<R, T> extends TestingLibraryMatchers<unknown, R> {}
}
