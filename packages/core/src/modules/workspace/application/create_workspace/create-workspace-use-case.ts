/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { Id, Name } from '@core/modules/workspace/domain/workspace'
import type { ModuleDependencies } from '../..'

type CreateWorkspaceParameters = {
	name: Name
	ownerId: string
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function createWorkspace(
	{ name, ownerId }: CreateWorkspaceParameters,
	dependencies: ModuleDependencies,
) {
	const workspaceId = dependencies.repository.generateId()
	const now = new Date().getTime()

	const workspace = await dependencies.repository.saveWorkspace({
		id: workspaceId,
		name,
		userIds: [ownerId],
		createdAt: now,
		updatedAt: now,
	})

	// Add owner as workspace member using workspace_member module
	await dependencies.workspaceMember.addMember(
		{
			workspaceId,
			userId: ownerId,
			role: 'owner',
		},
		dependencies.workspaceMember.dependencies,
	)

	return workspace
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

function authorizeCreateWorkspace(
	_parameters: CreateWorkspaceParameters,
	_dependencies: ModuleDependencies,
	session: Session,
) {
	if (!session.isAuthenticated()) {
		throw UnauthenticatedError.create()
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export {
	createWorkspace,
	type CreateWorkspaceParameters,
	authorizeCreateWorkspace,
}
