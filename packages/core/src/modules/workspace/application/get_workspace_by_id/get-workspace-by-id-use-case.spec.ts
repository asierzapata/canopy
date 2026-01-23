import { describe, it, expect, beforeEach, inject } from 'vitest'
import {
	getWorkspaceById,
	authorizeGetWorkspaceById,
	GetWorkspaceByIdParameters,
} from './get-workspace-by-id-use-case'
import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { WorkspaceNotFoundError } from '@core/modules/workspace/domain/errors/workspace-not-found'
import { UnauthorizedWorkspaceAccessError } from '@core/modules/workspace/domain/errors/unauthorized-workspace-access'
import { Session } from '@core/services/authentication/session/session'
import { SessionAuthorizationStatus } from '@core/services/authentication/session/session_authorization_status'
import type { ModuleDependencies } from '../..'
import { getDb } from '@core/testing/db'
import { createMongoDBWorkspaceRepository } from '../../infrastructure/repository/mongodb-workspace-repository'
import { uuid } from '@core/services/uuid'
import { Db } from 'mongodb'

describe('Use Case | Get Workspace By Id', () => {
	let db: Db
	let dependencies: ModuleDependencies
	let workspaceId: GetWorkspaceByIdParameters['workspaceId']
	let savedWorkspace: Parameters<
		typeof dependencies.repository.saveWorkspace
	>['0']
	let userId1: string
	let userId2: string

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'data', mongoUri })
		dependencies = {
			repository: createMongoDBWorkspaceRepository({ db }),
		}
		workspaceId = uuid()
		userId1 = uuid()
		userId2 = uuid()
		savedWorkspace = {
			id: workspaceId,
			name: 'Test Workspace',
			userIds: [userId1, userId2],
			createdAt: new Date().getTime(),
			updatedAt: new Date().getTime(),
		}
		await dependencies.repository.saveWorkspace(savedWorkspace)
	})

	describe('getWorkspaceById', () => {
		it('should return workspace when it exists', async () => {
			const result = await getWorkspaceById({ workspaceId }, dependencies)

			expect(result).toEqual(savedWorkspace)
		})

		it('should throw WorkspaceNotFoundError when workspace does not exist', async () => {
			await expect(
				getWorkspaceById({ workspaceId: uuid() }, dependencies),
			).rejects.toThrow(WorkspaceNotFoundError)
		})
	})

	describe('authorizeGetWorkspaceById', () => {
		it('should allow access for authenticated user in workspace', async () => {
			const session = new Session({
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
				distinctId: userId1,
				type: 'authenticated',
			})

			await expect(
				authorizeGetWorkspaceById({ workspaceId }, dependencies, session),
			).resolves.not.toThrow()
		})

		it('should reject unauthenticated users', async () => {
			const session = new Session({
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
				distinctId: userId1,
				type: 'unauthenticated',
			})

			await expect(
				authorizeGetWorkspaceById({ workspaceId }, dependencies, session),
			).rejects.toThrow(UnauthenticatedError)
		})

		it('should reject users not in workspace', async () => {
			const session = new Session({
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
				distinctId: uuid(), // Different UUID not in workspace
				type: 'authenticated',
			})

			await expect(
				authorizeGetWorkspaceById({ workspaceId }, dependencies, session),
			).rejects.toThrow(UnauthorizedWorkspaceAccessError)
		})

		it('should throw WorkspaceNotFoundError when workspace does not exist', async () => {
			const session = new Session({
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
				distinctId: userId1,
				type: 'authenticated',
			})

			await expect(
				authorizeGetWorkspaceById(
					{ workspaceId: uuid() },
					dependencies,
					session,
				),
			).rejects.toThrow(WorkspaceNotFoundError)
		})
	})
})
