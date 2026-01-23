import jwt, { type Algorithm, type Secret } from 'jsonwebtoken'
import { uuid } from '../uuid'

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

function createJWTService({
	secret,
	algorithm,
	expiration,
}: {
	secret: Secret
	algorithm: Algorithm
	expiration: number
}) {
	return {
		generateToken<P>(
			data: P,
			{ kid, sub }: { kid: string; sub: string },
		): Promise<string> {
			return new Promise((resolve, reject) => {
				jwt.sign(
					data,
					secret,
					{
						jwtid: uuid(),
						algorithm: algorithm,
						expiresIn: expiration,
						keyid: kid,
						subject: sub,
					},
					(err, token) => {
						if (err) return reject(err)
						if (!token) return reject(new Error('JWT Service - Invalid token'))
						return resolve(token)
					},
				)
			})
		},

		decodeToken<
			T extends {
				iat: number
				exp: number
				jti: string
			},
		>(token: string): Promise<T> {
			return new Promise((resolve, reject) => {
				jwt.verify(
					token,
					secret,
					{
						algorithms: [algorithm],
					},
					(err, data) => {
						if (err) return reject(err)

						if (!data) return reject(new Error('JWT Service - Invalid token'))

						if (typeof data !== 'object')
							return reject(new Error('JWT Service - Invalid token'))

						return resolve(data as T)
					},
				)
			})
		},
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export { createJWTService }
