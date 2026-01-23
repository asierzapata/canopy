import { beforeEach, describe, expect, inject, test } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'

import {
	removeWorkspaceMember,
	RemoveWorkspaceMemberParameters,
	authorizeRemoveWorkspaceMember,
	RemoveWorkspaceMemberDependencies,
} from './remove-workspace-member-use-case'
import { createMongoDBWorkspaceMemberRepository } from '../../infrastructure/repository/mongodb-workspace-member-repository'
import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { UnauthorizedWorkspaceMemberOperationError } from '../../domain/errors/unauthorized-workspace-member-operation'
import { Session } from '@core/services/authentication/session/session'
import { SessionAuthorizationStatus } from '@core/services/authentication/session/session_authorization_status'
import { uuid } from '@core/services/uuid'

describe('Use Case | Remove Workspace Member', () => {
	let db: Db
	let dependencies: RemoveWorkspaceMemberDependencies
	let parameters: RemoveWorkspaceMemberParameters
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
		}

		// Add requester as workspace member for authorization
		await dependencies.repository.addMember({
			workspaceId,
			userId: requesterId,
			role: 'owner',
			joinedAt: Date.now(),
			updatedAt: Date.now(),
		})

		// Add user to be removed
		await dependencies.repository.addMember({
			workspaceId,
			userId,
			role: 'member',
			joinedAt: Date.now(),
			updatedAt: Date.now(),
		})
	})

	describe('removeWorkspaceMember', () => {
		test('should remove member successfully', async () => {
			await removeWorkspaceMember(parameters, dependencies)

			const member = await dependencies.repository.getMember(workspaceId, userId)

			expect(member).toBeNull()
		})

		test('should be idempotent when removing non-existent member', async () => {
			const nonExistentParameters = {
				workspaceId,
				userId: uuid(),
			}

			// Should succeed even if member doesn't exist
			await expect(
				removeWorkspaceMember(nonExistentParameters, dependencies),
			).resolves.not.toThrow()
		})

		test('should be idempotent when called multiple times', async () => {
			// Remove member once
			await removeWorkspaceMember(parameters, dependencies)

			// Remove again - should succeed
			await expect(
				removeWorkspaceMember(parameters, dependencies),
			).resolves.not.toThrow()

			// Member should still be gone
			const member = await dependencies.repository.getMember(workspaceId, userId)
			expect(member).toBeNull()
		})
	})

	describe('authorizeRemoveWorkspaceMember', () => {
		test('should allow workspace members to remove users', async () => {
			const session = new Session({
				type: 'authenticated',
				distinctId: requesterId,
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			await expect(
				authorizeRemoveWorkspaceMember(parameters, dependencies, session),
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
				authorizeRemoveWorkspaceMember(parameters, dependencies, session),
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
				authorizeRemoveWorkspaceMember(parameters, dependencies, session),
			).rejects.toThrow(UnauthorizedWorkspaceMemberOperationError)
		})
	})
})
