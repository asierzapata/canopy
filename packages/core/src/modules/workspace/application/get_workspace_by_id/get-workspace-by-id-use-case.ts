/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { WorkspaceNotFoundError } from '@core/modules/workspace/domain/errors/workspace-not-found'
import { UnauthorizedWorkspaceAccessError } from '@core/modules/workspace/domain/errors/unauthorized-workspace-access'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { Id } from '../../domain/workspace'
import type { ModuleDependencies } from '../..'

type GetWorkspaceByIdParameters = {
	workspaceId: Id
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function getWorkspaceById(
	parameters: GetWorkspaceByIdParameters,
	dependencies: ModuleDependencies,
) {
	const workspace = await dependencies.repository.getWorkspaceById(
		parameters.workspaceId,
	)

	if (!workspace) {
		throw WorkspaceNotFoundError.create()
	}

	return workspace
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

async function authorizeGetWorkspaceById(
	parameters: GetWorkspaceByIdParameters,
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

	const userId = session.getDistinctId()
	if (!workspace.userIds.includes(userId!)) {
		throw UnauthorizedWorkspaceAccessError.create()
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export {
	getWorkspaceById,
	type GetWorkspaceByIdParameters,
	authorizeGetWorkspaceById,
}
