import type { RequestIdVariables } from 'hono/request-id'
import type { InjectedVariables } from './middleware/dependency-injection.middleware'
import type { AuthenticationVariables } from './middleware/authentication.middleware'

export type ModulesDependencies = Omit<InjectedVariables, 'modules'>

export type Dependencies = RequestIdVariables &
	InjectedVariables &
	AuthenticationVariables

export type HonoAppType = {
	Variables: Dependencies
}
