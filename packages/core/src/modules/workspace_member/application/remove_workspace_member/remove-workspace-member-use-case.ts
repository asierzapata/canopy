/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { WorkspaceMemberNotFoundError } from '../../domain/errors/workspace-member-not-found'
import { UnauthorizedWorkspaceMemberOperationError } from '../../domain/errors/unauthorized-workspace-member-operation'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { WorkspaceId, UserId } from '../../domain/workspace-member'
import type { WorkspaceMemberRepository } from '../../infrastructure/repository'

export type RemoveWorkspaceMemberParameters = {
	workspaceId: WorkspaceId
	userId: UserId
}

export type RemoveWorkspaceMemberDependencies = {
	repository: WorkspaceMemberRepository
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function removeWorkspaceMember(
	parameters: RemoveWorkspaceMemberParameters,
	dependencies: RemoveWorkspaceMemberDependencies,
): Promise<void> {
	// Check if member exists
	const member = await dependencies.repository.getMember(
		parameters.workspaceId,
		parameters.userId,
	)

	if (!member) {
		throw WorkspaceMemberNotFoundError.create()
	}

	// Remove member
	await dependencies.repository.removeMember(
		parameters.workspaceId,
		parameters.userId,
	)
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

async function authorizeRemoveWorkspaceMember(
	parameters: RemoveWorkspaceMemberParameters,
	dependencies: RemoveWorkspaceMemberDependencies,
	session: Session,
) {
	if (!session.isAuthenticated()) {
		throw UnauthenticatedError.create()
	}

	// Verify requester is workspace member
	const requesterId = session.getDistinctId()
	const isMember = await dependencies.repository.isMember(
		parameters.workspaceId,
		requesterId!,
	)

	if (!isMember) {
		throw UnauthorizedWorkspaceMemberOperationError.create()
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export {
	removeWorkspaceMember,
	authorizeRemoveWorkspaceMember,
}
