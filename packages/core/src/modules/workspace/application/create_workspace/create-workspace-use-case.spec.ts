import { beforeEach, describe, expect, inject, test } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'

import {
	createWorkspace,
	CreateWorkspaceParameters,
	authorizeCreateWorkspace,
} from './create-workspace-use-case'
import { createMongoDBWorkspaceRepository } from '../../infrastructure/repository/mongodb-workspace-repository'
import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { Session } from '@core/services/authentication/session/session'
import { SessionAuthorizationStatus } from '@core/services/authentication/session/session_authorization_status'
import { uuid } from '@core/services/uuid'
import type { ModuleDependencies } from '../..'

describe('Use Case | Create Workspace', () => {
	let db: Db
	let dependencies: ModuleDependencies
	let workspaceParameters: CreateWorkspaceParameters
	let userId: string

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'workspace', mongoUri })
		dependencies = {
			repository: createMongoDBWorkspaceRepository({ db }),
		}
		userId = uuid()
		workspaceParameters = {
			name: 'Test Workspace',
			ownerId: userId,
		}
	})

	describe('createWorkspace', () => {
		test('should not return the new workspace', async () => {
			const result = await createWorkspace(workspaceParameters, dependencies)

			// Verify nothing is returned
			expect(result).toBeUndefined()
		})

		test('should save the new workspace to the DB', async () => {
			await createWorkspace(workspaceParameters, dependencies)

			// Fetch workspaces from repository to verify one was saved
			const workspaces = await dependencies.repository.getWorkspacesByUserId(
				workspaceParameters.ownerId,
			)

			expect(workspaces.length).toBeGreaterThan(0)

			// Get the most recently created workspace
			const savedWorkspace = workspaces[0]

			expect(savedWorkspace).not.toBeNull()
			expect(savedWorkspace?.name).toEqual(workspaceParameters.name)
			expect(savedWorkspace?.userIds).toContain(workspaceParameters.ownerId)
			expect(savedWorkspace?.createdAt).toBeDefined()
			expect(savedWorkspace?.updatedAt).toBeDefined()
		})
	})

	describe('authorizeCreateWorkspace', () => {
		test('should allow authenticated users to create workspace', () => {
			const session = new Session({
				type: 'authenticated',
				distinctId: userId,
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			expect(() =>
				authorizeCreateWorkspace(workspaceParameters, dependencies, session),
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
				authorizeCreateWorkspace(workspaceParameters, dependencies, session),
			).toThrow(UnauthenticatedError)
		})
	})
})
