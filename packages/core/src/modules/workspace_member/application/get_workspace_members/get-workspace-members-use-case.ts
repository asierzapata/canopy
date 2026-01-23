/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { UnauthorizedWorkspaceMemberOperationError } from '../../domain/errors/unauthorized-workspace-member-operation'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { WorkspaceId, WorkspaceMember } from '../../domain/workspace-member'
import type { WorkspaceMemberRepository } from '../../infrastructure/repository'

export type GetWorkspaceMembersParameters = {
	workspaceId: WorkspaceId
}

export type GetWorkspaceMembersDependencies = {
	repository: WorkspaceMemberRepository
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function getWorkspaceMembers(
	parameters: GetWorkspaceMembersParameters,
	dependencies: GetWorkspaceMembersDependencies,
): Promise<WorkspaceMember[]> {
	return await dependencies.repository.getMembersByWorkspaceId(
		parameters.workspaceId,
	)
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

async function authorizeGetWorkspaceMembers(
	parameters: GetWorkspaceMembersParameters,
	dependencies: GetWorkspaceMembersDependencies,
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
	getWorkspaceMembers,
	authorizeGetWorkspaceMembers,
}
