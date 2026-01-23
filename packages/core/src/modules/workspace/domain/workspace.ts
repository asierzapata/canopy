import { z } from 'zod'

export const workspaceSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	userIds: z.array(z.uuid()),
	createdAt: z.number(),
	updatedAt: z.number(),
})

export type Workspace = z.infer<typeof workspaceSchema>

export type Id = z.infer<typeof workspaceSchema>['id']
export type Name = z.infer<typeof workspaceSchema>['name']
export type UserIds = z.infer<typeof workspaceSchema>['userIds']
export type CreatedAt = z.infer<typeof workspaceSchema>['createdAt']
export type UpdatedAt = z.infer<typeof workspaceSchema>['updatedAt']
