import { z } from 'zod'

export const accountSchema = z.object({
	id: z.string(),
	userId: z.string(),
	provider: z.literal('google'),
	providerAccountId: z.string(),
	refreshToken: z.string().optional().nullable(),
	accessToken: z.string().optional().nullable(),
	expiresAt: z.number().optional().nullable(),
	tokenType: z.string().optional().nullable(),
	createdAt: z.number(),
	updatedAt: z.number(),
})

export type Account = z.infer<typeof accountSchema>

export type Id = z.infer<typeof accountSchema>['id']
export type UserId = z.infer<typeof accountSchema>['userId']
export type Provider = z.infer<typeof accountSchema>['provider']
export type ProviderAccountId = z.infer<
	typeof accountSchema
>['providerAccountId']
export type RefreshToken = z.infer<typeof accountSchema>['refreshToken']
export type AccessToken = z.infer<typeof accountSchema>['accessToken']
export type ExpiresAt = z.infer<typeof accountSchema>['expiresAt']
export type TokenType = z.infer<typeof accountSchema>['tokenType']
export type CreatedAt = z.infer<typeof accountSchema>['createdAt']
export type UpdatedAt = z.infer<typeof accountSchema>['updatedAt']
