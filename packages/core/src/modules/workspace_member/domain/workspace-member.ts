import { z } from 'zod'

export const roleSchema = z.enum(['owner', 'member'])

export type Role = z.infer<typeof roleSchema>

export const workspaceMemberSchema = z.object({
	id: z.string().uuid(),
	workspaceId: z.string().uuid(),
	userId: z.string().uuid(),
	role: roleSchema,
	joinedAt: z.number(),
	updatedAt: z.number(),
})

export type WorkspaceMember = z.infer<typeof workspaceMemberSchema>

export type Id = z.infer<typeof workspaceMemberSchema>['id']
export type WorkspaceId = z.infer<typeof workspaceMemberSchema>['workspaceId']
export type UserId = z.infer<typeof workspaceMemberSchema>['userId']
export type JoinedAt = z.infer<typeof workspaceMemberSchema>['joinedAt']
export type UpdatedAt = z.infer<typeof workspaceMemberSchema>['updatedAt']
