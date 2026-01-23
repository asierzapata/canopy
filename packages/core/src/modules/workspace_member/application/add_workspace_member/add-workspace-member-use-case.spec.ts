import { beforeEach, describe, expect, inject, test } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'

import {
	addWorkspaceMember,
	AddWorkspaceMemberParameters,
	authorizeAddWorkspaceMember,
	AddWorkspaceMemberDependencies,
} from './add-workspace-member-use-case'
import { createMongoDBWorkspaceMemberRepository } from '../../infrastructure/repository/mongodb-workspace-member-repository'
import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { UnauthorizedWorkspaceMemberOperationError } from '../../domain/errors/unauthorized-workspace-member-operation'
import { Session } from '@core/services/authentication/session/session'
import { SessionAuthorizationStatus } from '@core/services/authentication/session/session_authorization_status'
import { uuid } from '@core/services/uuid'

describe('Use Case | Add Workspace Member', () => {
	let db: Db
	let dependencies: AddWorkspaceMemberDependencies
	let parameters: AddWorkspaceMemberParameters
	let workspaceId: string
	let userId: string
	let requesterId: string

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'workspace_member', mongoUri })
		dependencies = {
			repository: createMongoDBWorkspaceMemberRepository({ db }),
		}
		workspaceId = uuid()
		userId = uuid()
		requesterId = uuid()
		parameters = {
			workspaceId,
			userId,
			role: 'member',
		}

		// Add requester as workspace member for authorization
		await dependencies.repository.addMember({
			workspaceId,
			userId: requesterId,
			role: 'owner',
			joinedAt: Date.now(),
			updatedAt: Date.now(),
		})
	})

	describe('addWorkspaceMember', () => {
		test('should add member successfully', async () => {
			await addWorkspaceMember(parameters, dependencies)

			const member = await dependencies.repository.getMember(workspaceId, userId)

			expect(member).not.toBeNull()
			expect(member?.userId).toBe(userId)
			expect(member?.workspaceId).toBe(workspaceId)
			expect(member?.role).toBe('member')
		})

		test('should be idempotent when adding same member with same role', async () => {
			await addWorkspaceMember(parameters, dependencies)

			// Should succeed when called again with same parameters
			await expect(addWorkspaceMember(parameters, dependencies)).resolves.not.toThrow()

			// Member should still exist with same role
			const member = await dependencies.repository.getMember(workspaceId, userId)
			expect(member?.role).toBe('member')
		})

		test('should update role when adding existing member with different role', async () => {
			// Add as member
			await addWorkspaceMember(parameters, dependencies)

			// Add again as owner
			await addWorkspaceMember({
				...parameters,
				role: 'owner',
			}, dependencies)

			// Role should be updated
			const member = await dependencies.repository.getMember(workspaceId, userId)
			expect(member?.role).toBe('owner')
		})

		test('should add member with owner role', async () => {
			const ownerParameters = {
				...parameters,
				role: 'owner' as const,
			}

			await addWorkspaceMember(ownerParameters, dependencies)

			const member = await dependencies.repository.getMember(workspaceId, userId)

			expect(member?.role).toBe('owner')
		})

		test('should add member with member role', async () => {
			const memberParameters = {
				...parameters,
				role: 'member' as const,
			}

			await addWorkspaceMember(memberParameters, dependencies)

			const member = await dependencies.repository.getMember(workspaceId, userId)

			expect(member?.role).toBe('member')
		})
	})

	describe('authorizeAddWorkspaceMember', () => {
		test('should allow workspace members to add users', async () => {
			const session = new Session({
				type: 'authenticated',
				distinctId: requesterId,
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			await expect(
				authorizeAddWorkspaceMember(parameters, dependencies, session),
			).resolves.not.toThrow()
		})

		test('should reject unauthenticated users', async () => {
			const session = new Session({
				type: 'unauthenticated',
				distinctId: 'device-123',
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			await expect(
				authorizeAddWorkspaceMember(parameters, dependencies, session),
			).rejects.toThrow(UnauthenticatedError)
		})

		test('should reject non-member requester', async () => {
			const nonMemberId = uuid()
			const session = new Session({
				type: 'authenticated',
				distinctId: nonMemberId,
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			await expect(
				authorizeAddWorkspaceMember(parameters, dependencies, session),
			).rejects.toThrow(UnauthorizedWorkspaceMemberOperationError)
		})
	})
})
