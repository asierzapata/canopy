import { describe, expect, test } from 'vitest'
import { workspaceMemberSchema, roleSchema } from './workspace-member'
import { uuid } from '@core/services/uuid'

describe('Domain | WorkspaceMember', () => {
	describe('workspaceMemberSchema', () => {
		test('should validate a valid workspace member', () => {
			const validMember = {
				id: uuid(),
				workspaceId: uuid(),
				userId: uuid(),
				role: 'owner' as const,
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			}

			const result = workspaceMemberSchema.safeParse(validMember)

			expect(result.success).toBe(true)
		})

		test('should require all fields', () => {
			const invalidMember = {
				id: uuid(),
				workspaceId: uuid(),
				// missing userId
				role: 'member',
				joinedAt: Date.now(),
				// missing updatedAt
			}

			const result = workspaceMemberSchema.safeParse(invalidMember)

			expect(result.success).toBe(false)
		})

		test('should require valid UUID for id', () => {
			const invalidMember = {
				id: 'not-a-uuid',
				workspaceId: uuid(),
				userId: uuid(),
				role: 'owner',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			}

			const result = workspaceMemberSchema.safeParse(invalidMember)

			expect(result.success).toBe(false)
		})

		test('should require valid UUID for workspaceId', () => {
			const invalidMember = {
				id: uuid(),
				workspaceId: 'not-a-uuid',
				userId: uuid(),
				role: 'owner',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			}

			const result = workspaceMemberSchema.safeParse(invalidMember)

			expect(result.success).toBe(false)
		})

		test('should require valid UUID for userId', () => {
			const invalidMember = {
				id: uuid(),
				workspaceId: uuid(),
				userId: 'not-a-uuid',
				role: 'owner',
				joinedAt: Date.now(),
				updatedAt: Date.now(),
			}

			const result = workspaceMemberSchema.safeParse(invalidMember)

			expect(result.success).toBe(false)
		})

		test('should require valid timestamps', () => {
			const invalidMember = {
				id: uuid(),
				workspaceId: uuid(),
				userId: uuid(),
				role: 'owner',
				joinedAt: 'not-a-number',
				updatedAt: Date.now(),
			}

			const result = workspaceMemberSchema.safeParse(invalidMember)

			expect(result.success).toBe(false)
		})
	})

	describe('roleSchema', () => {
		test('should accept "owner" role', () => {
			const result = roleSchema.safeParse('owner')
			expect(result.success).toBe(true)
		})

		test('should accept "member" role', () => {
			const result = roleSchema.safeParse('member')
			expect(result.success).toBe(true)
		})

		test('should reject invalid role', () => {
			const result = roleSchema.safeParse('admin')
			expect(result.success).toBe(false)
		})

		test('should reject empty string', () => {
			const result = roleSchema.safeParse('')
			expect(result.success).toBe(false)
		})
	})
})
