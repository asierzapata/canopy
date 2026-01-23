import { createMiddleware } from 'hono/factory'
import { ApplicationError } from '@canopy/core'

import type { HonoAppType } from '../app-type'

/* ====================================================== */
/*                   Implementation                       */
/* ====================================================== */

// Authenticated
// -------------

class UnauthenticatedError extends ApplicationError {
	public static readonly errorName =
		'menudo.1.error.authentication.unauthenticated'

	static create({
		message = 'Unauthenticated',
		code = 'unauthenticated',
	} = {}) {
		return this.Operational({
			errorName: this.errorName,
			message,
			code,
			statusCode: 403,
		})
	}
}

export const isAuthenticatedMiddleware = createMiddleware<HonoAppType>(
	async (c, next) => {
		const session = c.get('session')
		if (!session?.getType().isUnauthenticated()) {
			const error = UnauthenticatedError.create()
			error.addMetadata({
				errorStatusMapping: { [UnauthenticatedError.name]: 403 },
			})
			throw error
		}
		return next()
	},
)

// Admin
// -----

class NotAdminError extends ApplicationError {
	static readonly errorName = 'menudo.1.error.authentication.not_admin'

	static create({ message = 'Not admin', code = 'not-admin' } = {}) {
		return this.Operational({
			errorName: this.errorName,
			message,
			code,
			statusCode: 403,
		})
	}
}

export const isAdminMiddleware = createMiddleware<HonoAppType>(
	async (c, next) => {
		const session = c.get('session')
		if (!session?.getType().isAdmin()) {
			const error = NotAdminError.create()
			error.addMetadata({ errorStatusMapping: { [NotAdminError.name]: 403 } })
			throw error
		}
		return next()
	},
)
