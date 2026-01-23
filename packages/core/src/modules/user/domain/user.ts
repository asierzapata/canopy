import { z } from 'zod'

export const userSchema = z.object({
	id: z.string(),
	firstName: z.string(),
	lastName: z.string(),
	picture: z.string(),
	email: z.string().optional(),
	createdAt: z.number(),
	updatedAt: z.number(),
})

export type User = z.infer<typeof userSchema>

export type Id = z.infer<typeof userSchema>['id']
export type FirstName = z.infer<typeof userSchema>['firstName']
export type LastName = z.infer<typeof userSchema>['lastName']
export type Picture = z.infer<typeof userSchema>['picture']
export type Email = z.infer<typeof userSchema>['email']
export type CreatedAt = z.infer<typeof userSchema>['createdAt']
export type UpdatedAt = z.infer<typeof userSchema>['updatedAt']
