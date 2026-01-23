import { createMiddleware } from 'hono/factory'
import clientPromise from '../db'

import { env } from '@/env'

import type { HonoAppType } from '../app-type'
import {
	type AuthenticationService,
	type Modules,
	modules,
	createAuthenticationService,
} from '@canopy/core'
import type { Db } from 'mongodb'

export type InjectedVariables = {
	dataDb: Db
	userDb: Db
	authenticationService: AuthenticationService
	modules: Modules
}

export const dependencyInjectionMiddleware = createMiddleware<HonoAppType>(
	async (c, next) => {
		const client = await clientPromise
		const dataDb = client.db('data')
		const userDb = client.db('user')
		c.set('dataDb', dataDb)
		c.set('userDb', userDb)
		const authenticationService = createAuthenticationService({
			algorithm: env.AUTH_JWT_ALGORITHM,
			secret: env.AUTH_JWT_SECRET,
			cookieName: env.AUTH_COOKIE_NAME,
			cookieDomain: env.AUTH_COOKIE_DOMAIN,
			expiration: env.AUTH_JWT_EXPIRATION,
			keyId: env.AUTH_JWT_KEY_ID,
		})
		c.set('authenticationService', authenticationService)
		c.set(
			'modules',
			modules({
				dataDb,
				userDb,
				authenticationService,
			}),
		)

		await next()
	},
)
