import ms from 'ms'
import { type Algorithm, type Secret } from 'jsonwebtoken'
import { type SessionTypeValue } from './session/session_type'
import { createJWTService } from '../jwt'
import type { Session } from './session/session'

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

export function createAuthenticationService({
	secret,
	algorithm,
	expiration,
	cookieName,
	cookieDomain,
	keyId,
}: {
	secret: Secret
	algorithm: Algorithm
	expiration: '1d' | '7d' | '14d' | '30d'
	cookieName: string
	cookieDomain?: string
	keyId: string
}) {
	const jwtService = createJWTService({
		secret,
		algorithm,
		expiration: ms(expiration),
	})

	const cookieConfig = {
		domain: cookieDomain,
		secure: true,
		httpOnly: true,
		maxAge: ms(expiration) / 1000, // Cookie maxAge is in seconds
	}

	return {
		async authenticate<T>(session: Session) {
			if (!session) throw new Error('AuthenticationService.authenticate')
			const token = await jwtService.generateToken(
				{
					type: session.getType().toValue(),
					distinctId: session.getDistinctId(),
					roles: session.getRoles(),
				},
				{
					sub: session.getDistinctId(),
					kid: keyId,
				},
			)
			return {
				jwtToken: token,
				authorizationHeader: {
					data: `Bearer ${token}`,
				},
				cookie: {
					cookieName: cookieName,
					data: token,
					config: cookieConfig,
				},
			}
		},

		async verify(token: string) {
			if (!token) return
			return jwtService.decodeToken<{
				type: SessionTypeValue
				distinctId: string
				roles: string[]
				iat: number
				exp: number
				jti: string
				sub: string
			}>(token)
		},

		async deauthenticate() {
			return {
				cookie: {
					cookieName: cookieName,
					data: '',
					config: {
						domain: cookieDomain,
						secure: true,
						httpOnly: true,
						maxAge: 0,
					},
				},
			}
		},
	}
}

export type AuthenticationService = ReturnType<
	typeof createAuthenticationService
>
