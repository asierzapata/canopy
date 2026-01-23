import { beforeEach, describe, expect, inject, it } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'

import {
	addUserToWorkspace,
	authorizeAddUserToWorkspace,
} from './add-user-to-workspace-use-case'
import { createMongoDBWorkspaceRepository } from '../../infrastructure/repository/mongodb-workspace-repository'
import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { WorkspaceNotFoundError } from '@core/modules/workspace/domain/errors/workspace-not-found'
import { UnauthorizedWorkspaceAccessError } from '@core/modules/workspace/domain/errors/unauthorized-workspace-access'
import { UserAlreadyInWorkspaceError } from '@core/modules/workspace/domain/errors/user-already-in-workspace'
import { Session } from '@core/services/authentication/session/session'
import { uuid } from '@core/services/uuid'
import type { ModuleDependencies } from '../..'
import type { Workspace } from '../../domain/workspace'

describe('Use Case | Add User To Workspace', () => {
	let db: Db
	let dependencies: ModuleDependencies
	let workspaceId: string
	let userId: string
	let newUserId: string

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'workspace', mongoUri })
		dependencies = {
			repository: createMongoDBWorkspaceRepository({ db }),
		}

		// Setup test data
		userId = uuid()
		newUserId = uuid()
		workspaceId = dependencies.repository.generateId()

		// Create a test workspace
		const workspace: Omit<Workspace, 'id'> & { id: string } = {
			id: workspaceId,
			name: 'Test Workspace',
			userIds: [userId],
			createdAt: Date.now(),
			updatedAt: Date.now(),
		}

		await dependencies.repository.saveWorkspace(workspace)
	})

	describe('addUserToWorkspace', () => {
		it('should add user to workspace successfully', async () => {
			await addUserToWorkspace({ workspaceId, userId: newUserId }, dependencies)

			// Verify user was added by fetching the workspace
			const updatedWorkspace = await dependencies.repository.getWorkspaceById(
				workspaceId,
			)

			expect(updatedWorkspace).not.toBeNull()
			expect(updatedWorkspace?.userIds).toContain(newUserId)
		})

		it('should throw WorkspaceNotFoundError when workspace does not exist', async () => {
			const nonExistentWorkspaceId = dependencies.repository.generateId()

			await expect(
				addUserToWorkspace(
					{ workspaceId: nonExistentWorkspaceId, userId: newUserId },
					dependencies,
				),
			).rejects.toThrow(WorkspaceNotFoundError)
		})

		it('should throw UserAlreadyInWorkspaceError when user is already in workspace', async () => {
			await expect(
				addUserToWorkspace({ workspaceId, userId }, dependencies),
			).rejects.toThrow(UserAlreadyInWorkspaceError)
		})
	})

	describe('authorizeAddUserToWorkspace', () => {
		it('should allow workspace member to add users', async () => {
			const session = Session.user({
				distinctId: userId,
			})
			session.setAsAuthorized()

			await expect(
				authorizeAddUserToWorkspace(
					{ workspaceId, userId: newUserId },
					dependencies,
					session,
				),
			).resolves.not.toThrow()
		})

		it('should reject unauthenticated users', async () => {
			const session = Session.unauthenticated()

			await expect(
				authorizeAddUserToWorkspace(
					{ workspaceId, userId: newUserId },
					dependencies,
					session,
				),
			).rejects.toThrow(UnauthenticatedError)
		})

		it('should reject users not in workspace', async () => {
			const nonMemberUserId = uuid()
			const session = Session.user({
				distinctId: nonMemberUserId,
			})
			session.setAsAuthorized()

			await expect(
				authorizeAddUserToWorkspace(
					{ workspaceId, userId: newUserId },
					dependencies,
					session,
				),
			).rejects.toThrow(UnauthorizedWorkspaceAccessError)
		})

		it('should throw WorkspaceNotFoundError when workspace does not exist', async () => {
			const nonExistentWorkspaceId = dependencies.repository.generateId()
			const session = Session.user({
				distinctId: userId,
			})
			session.setAsAuthorized()

			await expect(
				authorizeAddUserToWorkspace(
					{ workspaceId: nonExistentWorkspaceId, userId: newUserId },
					dependencies,
					session,
				),
			).rejects.toThrow(WorkspaceNotFoundError)
		})
	})
})
