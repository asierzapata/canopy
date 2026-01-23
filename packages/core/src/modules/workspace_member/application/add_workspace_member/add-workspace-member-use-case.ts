/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { UnauthorizedWorkspaceMemberOperationError } from '../../domain/errors/unauthorized-workspace-member-operation'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { WorkspaceId, UserId, Role } from '../../domain/workspace-member'
import type { WorkspaceMemberRepository } from '../../infrastructure/repository'

export type AddWorkspaceMemberParameters = {
	workspaceId: WorkspaceId
	userId: UserId
	role: Role
}

export type AddWorkspaceMemberDependencies = {
	repository: WorkspaceMemberRepository
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function addWorkspaceMember(
	parameters: AddWorkspaceMemberParameters,
	dependencies: AddWorkspaceMemberDependencies,
): Promise<void> {
	// Check if member already exists
	const existingMember = await dependencies.repository.getMember(
		parameters.workspaceId,
		parameters.userId,
	)

	if (existingMember) {
		// Idempotent: If member exists with same role, succeed
		if (existingMember.role === parameters.role) {
			return
		}
		// If role is different, update it
		await dependencies.repository.updateMemberRole(
			parameters.workspaceId,
			parameters.userId,
			parameters.role,
		)
		return
	}

	// Add member with timestamps
	const now = Date.now()
	await dependencies.repository.addMember({
		workspaceId: parameters.workspaceId,
		userId: parameters.userId,
		role: parameters.role,
		joinedAt: now,
		updatedAt: now,
	})
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

async function authorizeAddWorkspaceMember(
	parameters: AddWorkspaceMemberParameters,
	dependencies: AddWorkspaceMemberDependencies,
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
	addWorkspaceMember,
	authorizeAddWorkspaceMember,
}
