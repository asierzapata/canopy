import { env } from '@/env'
import { Hono } from 'hono'
import type { HonoAppType } from '@/app-type'
import { githubAuth } from '@hono/oauth-providers/github'
import { HTTPException } from 'hono/http-exception'
import { setCookie } from 'hono/cookie'
import { generateDbId, Session } from '@core/index'
import { successResponse } from '@/utils/response_factory'

// Parent: /api/auth
export const app = new Hono<HonoAppType>()

app.use(
	'/github',
	githubAuth({
		client_id: env.GITHUB_ID,
		client_secret: env.GITHUB_SECRET,
		scope: ['public_repo', 'read:user', 'user', 'user:email', 'user:follow'],
		oauthApp: true,
	}),
)

app.get('/github', async c => {
	const session = c.get('session')
	const githubUser = c.get('user-github')

	if (!githubUser || !githubUser.id) {
		throw new HTTPException(404, { message: 'User Not Found' })
	}

	// Find or create user account
	const account = await c
		.get('modules')
		.account.getAccountByProviderAndProviderAccountId(
			{
				provider: 'google',
				providerAccountId: `${githubUser.id}`,
			},
			session,
		)

	let userId = account?.userId

	if (!userId) {
		userId = generateDbId()

		await c.get('modules').account.createAccount(
			{
				userId,
				provider: 'google',
				providerAccountId: `${githubUser.id}`,
			},
			session,
		)

		await c.get('modules').user.createUser(
			{
				userId,
				email: githubUser.email ?? '',
				firstName: githubUser.name ?? '',
				lastName: '',
				picture: githubUser.avatar_url ?? '',
			},
			session,
		)
	}

	const user = await c.get('modules').user.getUserById({ userId }, session)

	const newSession = Session.user({
		...session,
		distinctId: userId,
	})

	const { jwtToken, cookie } = await c
		.get('authenticationService')
		.authenticate(newSession)

	const cookieData = cookie.data

	if (!cookieData) {
		throw new HTTPException(500, { message: 'Cookie data not found' })
	}

	setCookie(c, cookie.cookieName, cookieData, cookie.config)

	return successResponse({
		c,
		statusCode: 200,
		data: { user },
		meta: { token: jwtToken },
	})
})

export default app
