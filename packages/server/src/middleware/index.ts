/**
 * Middleware Exports
 *
 * Central export point for all middleware used in the application.
 */

export { authenticationMiddleware } from './authentication.middleware'
export type { AuthenticationVariables } from './authentication.middleware'

export { dependencyInjectionMiddleware } from './dependency-injection.middleware'
export type { InjectedVariables } from './dependency-injection.middleware'
