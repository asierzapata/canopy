import { beforeEach, describe, expect, inject, test } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'

import {
	getWorkspaceMembers,
	GetWorkspaceMembersParameters,
	authorizeGetWorkspaceMembers,
	GetWorkspaceMembersDependencies,
} from './get-workspace-members-use-case'
import { createMongoDBWorkspaceMemberRepository } from '../../infrastructure/repository/mongodb-workspace-member-repository'
import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { UnauthorizedWorkspaceMemberOperationError } from '../../domain/errors/unauthorized-workspace-member-operation'
import { Session } from '@core/services/authentication/session/session'
import { SessionAuthorizationStatus } from '@core/services/authentication/session/session_authorization_status'
import { uuid } from '@core/services/uuid'

describe('Use Case | Get Workspace Members', () => {
	let db: Db
	let dependencies: GetWorkspaceMembersDependencies
	let parameters: GetWorkspaceMembersParameters
	let workspaceId: string
	let requesterId: string

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'workspace_member', mongoUri })
		dependencies = {
			repository: createMongoDBWorkspaceMemberRepository({ db }),
		}
		workspaceId = uuid()
		requesterId = uuid()
		parameters = {
			workspaceId,
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

	describe('getWorkspaceMembers', () => {
		test('should return all workspace members', async () => {
			const user1 = uuid()
			const user2 = uuid()

			await dependencies.repository.addMember({
				workspaceId,
				userId: user1,
				role: 'member',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			await dependencies.repository.addMember({
				workspaceId,
				userId: user2,
				role: 'member',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			const members = await getWorkspaceMembers(parameters, dependencies)

			// Should include requester + 2 new members
			expect(members).toHaveLength(3)
			expect(members.map(m => m.userId)).toContain(user1)
			expect(members.map(m => m.userId)).toContain(user2)
			expect(members.map(m => m.userId)).toContain(requesterId)
		})

		test('should return empty array for workspace with no members', async () => {
			const emptyWorkspaceId = uuid()
			const emptyParameters = {
				workspaceId: emptyWorkspaceId,
			}

			const members = await getWorkspaceMembers(emptyParameters, dependencies)

			expect(members).toHaveLength(0)
		})
	})

	describe('authorizeGetWorkspaceMembers', () => {
		test('should allow workspace members to view members', async () => {
			const session = new Session({
				type: 'authenticated',
				distinctId: requesterId,
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			await expect(
				authorizeGetWorkspaceMembers(parameters, dependencies, session),
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
				authorizeGetWorkspaceMembers(parameters, dependencies, session),
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
				authorizeGetWorkspaceMembers(parameters, dependencies, session),
			).rejects.toThrow(UnauthorizedWorkspaceMemberOperationError)
		})
	})
})
