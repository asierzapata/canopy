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

	await dependencies.repository.saveWorkspace({
		id: workspaceId,
		name,
		userIds: [ownerId],
		createdAt: now,
		updatedAt: now,
	})

	// Return workspace ID for caller to create workspace member record
	return { workspaceId, ownerId }
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
