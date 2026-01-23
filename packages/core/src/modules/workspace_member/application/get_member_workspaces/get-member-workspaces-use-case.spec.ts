import { beforeEach, describe, expect, inject, test } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'

import {
	getMemberWorkspaces,
	GetMemberWorkspacesParameters,
	authorizeGetMemberWorkspaces,
	GetMemberWorkspacesDependencies,
} from './get-member-workspaces-use-case'
import { createMongoDBWorkspaceMemberRepository } from '../../infrastructure/repository/mongodb-workspace-member-repository'
import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { UnauthorizedWorkspaceMemberOperationError } from '../../domain/errors/unauthorized-workspace-member-operation'
import { Session } from '@core/services/authentication/session/session'
import { SessionAuthorizationStatus } from '@core/services/authentication/session/session_authorization_status'
import { uuid } from '@core/services/uuid'

describe('Use Case | Get Member Workspaces', () => {
	let db: Db
	let dependencies: GetMemberWorkspacesDependencies
	let parameters: GetMemberWorkspacesParameters
	let userId: string

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'workspace_member', mongoUri })
		dependencies = {
			repository: createMongoDBWorkspaceMemberRepository({ db }),
		}
		userId = uuid()
		parameters = {
			userId,
		}
	})

	describe('getMemberWorkspaces', () => {
		test('should return all user workspaces', async () => {
			const workspace1 = uuid()
			const workspace2 = uuid()

			await dependencies.repository.addMember({
				workspaceId: workspace1,
				userId,
				role: 'owner',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			await dependencies.repository.addMember({
				workspaceId: workspace2,
				userId,
				role: 'member',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			const workspaces = await getMemberWorkspaces(parameters, dependencies)

			expect(workspaces).toHaveLength(2)
			expect(workspaces.map(m => m.workspaceId)).toContain(workspace1)
			expect(workspaces.map(m => m.workspaceId)).toContain(workspace2)
		})

		test('should return empty array for user with no workspaces', async () => {
			const workspaces = await getMemberWorkspaces(parameters, dependencies)

			expect(workspaces).toHaveLength(0)
		})
	})

	describe('authorizeGetMemberWorkspaces', () => {
		test('should allow users to view their own workspaces', () => {
			const session = new Session({
				type: 'authenticated',
				distinctId: userId,
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			expect(() =>
				authorizeGetMemberWorkspaces(parameters, dependencies, session),
			).not.toThrow()
		})

		test('should reject unauthenticated users', () => {
			const session = new Session({
				type: 'unauthenticated',
				distinctId: 'device-123',
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			expect(() =>
				authorizeGetMemberWorkspaces(parameters, dependencies, session),
			).toThrow(UnauthenticatedError)
		})

		test('should reject requester from accessing other user workspaces', () => {
			const otherUserId = uuid()
			const session = new Session({
				type: 'authenticated',
				distinctId: otherUserId,
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			expect(() =>
				authorizeGetMemberWorkspaces(parameters, dependencies, session),
			).toThrow(UnauthorizedWorkspaceMemberOperationError)
		})
	})
})
