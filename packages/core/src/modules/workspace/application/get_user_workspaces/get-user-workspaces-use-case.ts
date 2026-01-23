/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { ModuleDependencies } from '../..'

type GetUserWorkspacesParameters = {
	userId: string
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function getUserWorkspaces(
	parameters: GetUserWorkspacesParameters,
	dependencies: ModuleDependencies,
) {
	return dependencies.repository.getWorkspacesByUserId(parameters.userId)
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

function authorizeGetUserWorkspaces(
	parameters: GetUserWorkspacesParameters,
	_dependencies: ModuleDependencies,
	session: Session,
) {
	if (!session.isAuthenticated()) {
		throw UnauthenticatedError.create()
	}

	// Users can only get their own workspaces
	const sessionUserId = session.getDistinctId()
	if (sessionUserId !== parameters.userId) {
		throw UnauthenticatedError.create({
			message: 'Cannot access other users workspaces',
			code: 'unauthorized-user-access',
		})
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export {
	getUserWorkspaces,
	type GetUserWorkspacesParameters,
	authorizeGetUserWorkspaces,
}
