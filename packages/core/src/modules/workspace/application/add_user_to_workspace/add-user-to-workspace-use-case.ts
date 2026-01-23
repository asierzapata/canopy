/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { WorkspaceNotFoundError } from '@core/modules/workspace/domain/errors/workspace-not-found'
import { UnauthorizedWorkspaceAccessError } from '@core/modules/workspace/domain/errors/unauthorized-workspace-access'
import { UserAlreadyInWorkspaceError } from '@core/modules/workspace/domain/errors/user-already-in-workspace'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { Id } from '../../domain/workspace'
import type { ModuleDependencies } from '../..'

type AddUserToWorkspaceParameters = {
	workspaceId: Id
	userId: string
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function addUserToWorkspace(
	parameters: AddUserToWorkspaceParameters,
	dependencies: ModuleDependencies,
) {
	const workspace = await dependencies.repository.getWorkspaceById(
		parameters.workspaceId,
	)

	if (!workspace) {
		throw WorkspaceNotFoundError.create()
	}

	if (workspace.userIds.includes(parameters.userId)) {
		throw UserAlreadyInWorkspaceError.create()
	}

	await dependencies.repository.addUserToWorkspace(
		parameters.workspaceId,
		parameters.userId,
	)

	// Add workspace member record using workspace_member module
	await dependencies.workspaceMember.addMember(
		{
			workspaceId: parameters.workspaceId,
			userId: parameters.userId,
			role: 'member',
		},
		dependencies.workspaceMember.dependencies,
	)
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

async function authorizeAddUserToWorkspace(
	parameters: AddUserToWorkspaceParameters,
	dependencies: ModuleDependencies,
	session: Session,
) {
	if (!session.isAuthenticated()) {
		throw UnauthenticatedError.create()
	}

	const workspace = await dependencies.repository.getWorkspaceById(
		parameters.workspaceId,
	)

	if (!workspace) {
		throw WorkspaceNotFoundError.create()
	}

	// User must be in the workspace to add other users
	const sessionUserId = session.getDistinctId()
	if (!workspace.userIds.includes(sessionUserId!)) {
		throw UnauthorizedWorkspaceAccessError.create({
			message: 'Only workspace members can add users',
		})
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export {
	addUserToWorkspace,
	type AddUserToWorkspaceParameters,
	authorizeAddUserToWorkspace,
}
