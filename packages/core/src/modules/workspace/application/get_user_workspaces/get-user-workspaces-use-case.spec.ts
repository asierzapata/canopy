import { describe, it, expect, beforeEach, inject, vi } from 'vitest'
import {
	getUserWorkspaces,
	authorizeGetUserWorkspaces,
} from './get-user-workspaces-use-case'
import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { Session } from '@core/services/authentication/session/session'
import { SessionAuthorizationStatus } from '@core/services/authentication/session/session_authorization_status'
import type { ModuleDependencies } from '../..'
import type { Workspace } from '../../domain/workspace'
import { getDb } from '@core/testing/db'
import { Db } from 'mongodb'
import { createMongoDBWorkspaceRepository } from '../../infrastructure/repository/mongodb-workspace-repository'
import { uuid } from '@core/services/uuid'

describe('Use Case | Get User Workspaces', () => {
	let db: Db
	let dependencies: ModuleDependencies
	let userId: string
	let workspaces: Workspace[]

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'data', mongoUri })
		dependencies = {
			repository: createMongoDBWorkspaceRepository({ db }),
		}

		userId = uuid()

		workspaces = [
			{
				id: uuid(),
				name: 'First Workspace',
				userIds: [userId],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
			{
				id: uuid(),
				name: 'Second Workspace',
				userIds: [userId, uuid()],
				createdAt: Date.now(),
				updatedAt: Date.now(),
			},
		]

		// Save workspaces to repository
		for (const workspace of workspaces) {
			await dependencies.repository.saveWorkspace(workspace)
		}
	})

	describe('getUserWorkspaces', () => {
		it('should return user workspaces', async () => {
			const result = await getUserWorkspaces({ userId }, dependencies)

			expect(result).toHaveLength(2)
			expect(result[0]?.userIds).toContain(userId)
			expect(result[1]?.userIds).toContain(userId)
		})

		it('should return empty array when user has no workspaces', async () => {
			const result = await getUserWorkspaces(
				{ userId: 'user-999' },
				dependencies,
			)

			expect(result).toEqual([])
		})
	})

	describe('authorizeGetUserWorkspaces', () => {
		it('should allow authenticated user to get their own workspaces', () => {
			const session = new Session({
				authorizationStatus: SessionAuthorizationStatus.authorized().toValue(),
				type: 'authenticated',
				distinctId: userId,
			})

			expect(() =>
				authorizeGetUserWorkspaces({ userId }, dependencies, session),
			).not.toThrow()
		})

		it('should reject unauthenticated users', () => {
			const session = new Session({
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
				type: 'unauthenticated',
				distinctId: '',
			})

			expect(() =>
				authorizeGetUserWorkspaces(
					{ userId: 'user-123' },
					dependencies,
					session,
				),
			).toThrow(UnauthenticatedError)
		})

		it('should reject user trying to access other users workspaces', () => {
			const session = new Session({
				authorizationStatus: SessionAuthorizationStatus.authorized().toValue(),
				type: 'authenticated',
				distinctId: userId,
			})

			expect(() =>
				authorizeGetUserWorkspaces({ userId: uuid() }, dependencies, session),
			).toThrow(UnauthenticatedError)
		})
	})
})
