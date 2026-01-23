import { beforeEach, describe, expect, inject, test } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'

import {
	checkWorkspaceMembership,
	CheckWorkspaceMembershipParameters,
	authorizeCheckWorkspaceMembership,
	CheckWorkspaceMembershipDependencies,
} from './check-workspace-membership-use-case'
import { createMongoDBWorkspaceMemberRepository } from '../../infrastructure/repository/mongodb-workspace-member-repository'
import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { Session } from '@core/services/authentication/session/session'
import { SessionAuthorizationStatus } from '@core/services/authentication/session/session_authorization_status'
import { uuid } from '@core/services/uuid'

describe('Use Case | Check Workspace Membership', () => {
	let db: Db
	let dependencies: CheckWorkspaceMembershipDependencies
	let parameters: CheckWorkspaceMembershipParameters
	let workspaceId: string
	let userId: string

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'workspace_member', mongoUri })
		dependencies = {
			repository: createMongoDBWorkspaceMemberRepository({ db }),
		}
		workspaceId = uuid()
		userId = uuid()
		parameters = {
			workspaceId,
			userId,
		}
	})

	describe('checkWorkspaceMembership', () => {
		test('should return true for existing member', async () => {
			// Add member first
			await dependencies.repository.addMember({
				workspaceId,
				userId,
				role: 'owner',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			const result = await checkWorkspaceMembership(parameters, dependencies)

			expect(result).toBe(true)
		})

		test('should return false for non-member', async () => {
			const result = await checkWorkspaceMembership(parameters, dependencies)

			expect(result).toBe(false)
		})
	})

	describe('authorizeCheckWorkspaceMembership', () => {
		test('should allow authenticated users', () => {
			const session = new Session({
				type: 'authenticated',
				distinctId: userId,
				authorizationStatus:
					SessionAuthorizationStatus.unauthorized().toValue(),
			})

			expect(() =>
				authorizeCheckWorkspaceMembership(parameters, dependencies, session),
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
				authorizeCheckWorkspaceMembership(parameters, dependencies, session),
			).toThrow(UnauthenticatedError)
		})
	})
})
