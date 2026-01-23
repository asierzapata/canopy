import type { ModulesDependencies } from './shared/types'

import accountModule from './account'
import userModule from './user'
import workspaceModule from './workspace'
import workspaceMemberModule from './workspace_member'

export function modules(dependencies: ModulesDependencies) {
	return {
		account: accountModule(dependencies),
		user: userModule(dependencies),
		workspace: workspaceModule(dependencies),
		workspaceMember: workspaceMemberModule(dependencies),
	}
}

export type Modules = ReturnType<typeof modules>
export type ModulesFactory = typeof modules
