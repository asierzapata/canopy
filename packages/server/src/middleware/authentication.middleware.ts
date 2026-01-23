import { createMiddleware } from 'hono/factory'

import { env } from '@/env'
import { getCookie, setCookie } from 'hono/cookie'

import { fromUnixTime, isAfter, sub } from 'date-fns'

import {
	type AuthenticationService,
	Session,
	SessionDevice,
} from '@canopy/core'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { HonoAppType } from '../app-type'
import type { Context } from 'hono'
import { SessionSource } from '@canopy/core/src/services/authentication/session/session_source'

export type AuthenticationVariables = {
	session: Session
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

export const authenticationMiddleware = createMiddleware<HonoAppType>(
	async (c, next) => {
		const userAgent = c.req.header('User-Agent')
		const clientSessionId = c.req.header('Client-Session-Id')
		// const clientVersion = c.req.header('Client-Version')
		const clientWindowWidth = c.req.header('Client-Window-Width')
		const clientWindowHeight = c.req.header('Client-Window-Height')

		const sessionToken = getTokenFromRequest(c)

		const authenticationService = c.get('authenticationService')

		const sessionData = await authenticationService.verify(sessionToken)
		const device = SessionDevice.browserUserAgent({
			userAgent,
			screenWidth: clientWindowWidth,
			screenHeight: clientWindowHeight,
		}).toValue()

		console.log({ sessionData })

		if (!sessionData) {
			c.set(
				'session',
				Session.unauthenticated({
					id: clientSessionId,
					device,
					source: SessionSource.httpRequest().toValue(),
				}),
			)
			return next()
		}

		const session = new Session({
			id: clientSessionId,
			type: sessionData.type,
			distinctId: sessionData.distinctId,
			device,
		})

		const { refreshedCookie, refreshedAutorizationHeader } = await refreshToken(
			{
				session,
				currentToken: {
					iat: sessionData.iat,
					exp: sessionData.exp,
					jti: sessionData.jti,
				},
				authenticationService: authenticationService,
			},
		)
		if (refreshedAutorizationHeader) {
			c.res.headers.append('Authorization', refreshedAutorizationHeader.data)
		}
		if (refreshedCookie?.data) {
			setCookie(
				c,
				refreshedCookie.cookieName,
				refreshedCookie.data,
				refreshedCookie.config,
			)
		}

		c.set('session', session)

		return next()

		await next()
	},
)

/* ====================================================== */
/*                        Helpers                         */
/* ====================================================== */

async function refreshToken({
	session,
	currentToken,
	authenticationService,
}: {
	session: Session
	currentToken: { iat: number; exp: number; jti: string }
	authenticationService: AuthenticationService
}) {
	const mIssuedAt = fromUnixTime(currentToken.iat)
	const mHoursAgo = sub(new Date(), { hours: 1 })

	// Do not refresh if token was issued less than 1 hour ago
	if (isAfter(mIssuedAt, mHoursAgo)) return {}

	// TODO: Blacklist the tokenId (currentToken.jti)

	const { jwtToken, cookie, authorizationHeader } =
		await authenticationService.authenticate(session)

	return {
		refreshedJwtToken: jwtToken,
		refreshedCookie: cookie,
		refreshedAutorizationHeader: authorizationHeader,
	}
}

function getTokenFromRequest(c: Context) {
	let token = ''

	const authenticationCookie = getCookie(c, env.AUTH_COOKIE_NAME)

	console.log({ authenticationCookie })

	// Get token from cookie
	if (authenticationCookie) token = authenticationCookie

	// Get token from Header "Authorization: 'Bearer abc.123.xyz'"
	const authorizationHeader = c.req.header('Authorization')
	console.log({ authorizationHeader })
	if (authorizationHeader) token = authorizationHeader.replace('Bearer ', '')

	console.log({ token })

	return token
}
