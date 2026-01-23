import { beforeEach, describe, expect, inject, test } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'
import { createMongoDBWorkspaceMemberRepository } from './mongodb-workspace-member-repository'
import { uuid } from '@core/services/uuid'
import type { WorkspaceMemberRepository } from '.'

describe('Repository | MongoDB Workspace Member', () => {
	let db: Db
	let repository: WorkspaceMemberRepository
	let workspaceId: string
	let userId: string

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'workspace_member', mongoUri })
		repository = createMongoDBWorkspaceMemberRepository({ db })
		workspaceId = uuid()
		userId = uuid()
	})

	describe('addMember', () => {
		test('should create member record correctly', async () => {
			const member = {
				workspaceId,
				userId,
				role: 'owner' as const,
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			}

			await repository.addMember(member)

			const result = await repository.getMember(workspaceId, userId)

			expect(result).not.toBeNull()
			expect(result?.workspaceId).toBe(workspaceId)
			expect(result?.userId).toBe(userId)
			expect(result?.role).toBe('owner')
		})

		test('should prevent duplicate memberships', async () => {
			const member = {
				workspaceId,
				userId,
				role: 'member' as const,
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			}

			await repository.addMember(member)

			// Try to add the same member again
			await expect(repository.addMember(member)).rejects.toThrow()
		})
	})

	describe('removeMember', () => {
		test('should delete member record', async () => {
			const member = {
				workspaceId,
				userId,
				role: 'member' as const,
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			}

			await repository.addMember(member)
			await repository.removeMember(workspaceId, userId)

			const result = await repository.getMember(workspaceId, userId)
			expect(result).toBeNull()
		})
	})

	describe('getMembersByWorkspaceId', () => {
		test('should return correct members for workspace', async () => {
			const user1 = uuid()
			const user2 = uuid()

			await repository.addMember({
				workspaceId,
				userId: user1,
				role: 'owner',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			await repository.addMember({
				workspaceId,
				userId: user2,
				role: 'member',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			const members = await repository.getMembersByWorkspaceId(workspaceId)

			expect(members).toHaveLength(2)
			expect(members.map(m => m.userId)).toContain(user1)
			expect(members.map(m => m.userId)).toContain(user2)
		})

		test('should return empty array for workspace with no members', async () => {
			const emptyWorkspaceId = uuid()
			const members = await repository.getMembersByWorkspaceId(emptyWorkspaceId)

			expect(members).toHaveLength(0)
		})
	})

	describe('getMembersByUserId', () => {
		test('should return correct workspaces for user', async () => {
			const workspace1 = uuid()
			const workspace2 = uuid()

			await repository.addMember({
				workspaceId: workspace1,
				userId,
				role: 'owner',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			await repository.addMember({
				workspaceId: workspace2,
				userId,
				role: 'member',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			const workspaces = await repository.getMembersByUserId(userId)

			expect(workspaces).toHaveLength(2)
			expect(workspaces.map(m => m.workspaceId)).toContain(workspace1)
			expect(workspaces.map(m => m.workspaceId)).toContain(workspace2)
		})

		test('should return empty array for user with no workspaces', async () => {
			const newUserId = uuid()
			const workspaces = await repository.getMembersByUserId(newUserId)

			expect(workspaces).toHaveLength(0)
		})
	})

	describe('getMember', () => {
		test('should return specific member record', async () => {
			const member = {
				workspaceId,
				userId,
				role: 'owner' as const,
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			}

			await repository.addMember(member)

			const result = await repository.getMember(workspaceId, userId)

			expect(result).not.toBeNull()
			expect(result?.workspaceId).toBe(workspaceId)
			expect(result?.userId).toBe(userId)
			expect(result?.role).toBe('owner')
		})

		test('should return null for non-existent member', async () => {
			const result = await repository.getMember(uuid(), uuid())

			expect(result).toBeNull()
		})
	})

	describe('isMember', () => {
		test('should return true for existing member', async () => {
			await repository.addMember({
				workspaceId,
				userId,
				role: 'member',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			const result = await repository.isMember(workspaceId, userId)

			expect(result).toBe(true)
		})

		test('should return false for non-existent member', async () => {
			const result = await repository.isMember(uuid(), uuid())

			expect(result).toBe(false)
		})
	})

	describe('updateMemberRole', () => {
		test('should update member role field', async () => {
			await repository.addMember({
				workspaceId,
				userId,
				role: 'member',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			})

			await repository.updateMemberRole(workspaceId, userId, 'owner')

			const result = await repository.getMember(workspaceId, userId)

			expect(result?.role).toBe('owner')
		})
	})

	describe('generateId', () => {
		test('should create valid UUID', () => {
			const id = repository.generateId()

			expect(id).toBeDefined()
			expect(typeof id).toBe('string')
			// UUID v4 format
			expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
		})
	})
})
