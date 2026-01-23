import type { ModulesDependencies } from './shared/types'

import accountModule from './account'
import userModule from './user'
import workspaceModule from './workspace'

export function modules(dependencies: ModulesDependencies) {
	return {
		account: accountModule(dependencies),
		user: userModule(dependencies),
		workspace: workspaceModule(dependencies),
	}
}

export type Modules = ReturnType<typeof modules>
export type ModulesFactory = typeof modules
