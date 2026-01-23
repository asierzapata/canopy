/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { WorkspaceId, UserId } from '../../domain/workspace-member'
import type { WorkspaceMemberRepository } from '../../infrastructure/repository'

export type CheckWorkspaceMembershipParameters = {
	workspaceId: WorkspaceId
	userId: UserId
}

export type CheckWorkspaceMembershipDependencies = {
	repository: WorkspaceMemberRepository
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function checkWorkspaceMembership(
	parameters: CheckWorkspaceMembershipParameters,
	dependencies: CheckWorkspaceMembershipDependencies,
): Promise<boolean> {
	return await dependencies.repository.isMember(
		parameters.workspaceId,
		parameters.userId,
	)
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

function authorizeCheckWorkspaceMembership(
	_parameters: CheckWorkspaceMembershipParameters,
	_dependencies: CheckWorkspaceMembershipDependencies,
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
	checkWorkspaceMembership,
	authorizeCheckWorkspaceMembership,
}
