/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { UnauthorizedWorkspaceMemberOperationError } from '../../domain/errors/unauthorized-workspace-member-operation'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { UserId, WorkspaceMember } from '../../domain/workspace-member'
import type { WorkspaceMemberRepository } from '../../infrastructure/repository'

export type GetMemberWorkspacesParameters = {
	userId: UserId
}

export type GetMemberWorkspacesDependencies = {
	repository: WorkspaceMemberRepository
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function getMemberWorkspaces(
	parameters: GetMemberWorkspacesParameters,
	dependencies: GetMemberWorkspacesDependencies,
): Promise<WorkspaceMember[]> {
	return await dependencies.repository.getMembersByUserId(
		parameters.userId,
	)
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

function authorizeGetMemberWorkspaces(
	parameters: GetMemberWorkspacesParameters,
	_dependencies: GetMemberWorkspacesDependencies,
	session: Session,
) {
	if (!session.isAuthenticated()) {
		throw UnauthenticatedError.create()
	}

	// Verify requester can only access their own workspaces
	const requesterId = session.getDistinctId()
	if (parameters.userId !== requesterId) {
		throw UnauthorizedWorkspaceMemberOperationError.create()
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export {
	getMemberWorkspaces,
	authorizeGetMemberWorkspaces,
}
