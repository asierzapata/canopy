import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

export const env = createEnv({
	/**
	 * Specify your server-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars.
	 */
	server: {
		MONGODB_URI: z.string().url(),
		NODE_ENV: z
			.enum(['development', 'test', 'production'])
			.default('development'),
		AUTH_COOKIE_NAME: z.string().default('menudo-auth'),
		AUTH_COOKIE_DOMAIN: z.string().optional(),
		AUTH_JWT_SECRET: z.string().min(1),
		AUTH_JWT_EXPIRATION: z.enum(['1d', '7d', '14d', '30d']).default('7d'),
		AUTH_JWT_ALGORITHM: z
			.enum(['HS256', 'HS384', 'HS512', 'RS256', 'RS384', 'RS512'])
			.default('HS256'),
		// TODO: Make this not optional later
		AUTH_JWT_KEY_ID: z.string().min(1),
		GITHUB_ID: z.string().min(1),
		GITHUB_SECRET: z.string().min(1),
	},

	clientPrefix: 'PUBLIC_',

	/**
	 * Specify your client-side environment variables schema here. This way you can ensure the app
	 * isn't built with invalid env vars. To expose them to the client, prefix them with
	 * `NEXT_PUBLIC_`.
	 */
	client: {},

	/**
	 * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
	 * middlewares) or client-side so we need to destruct manually.
	 */
	runtimeEnv: {
		MONGODB_URI: process.env.MONGODB_URI,
		NODE_ENV: process.env.NODE_ENV,
		AUTH_COOKIE_NAME: process.env.AUTH_COOKIE_NAME,
		AUTH_COOKIE_DOMAIN: process.env.AUTH_COOKIE_DOMAIN,
		AUTH_JWT_SECRET: process.env.AUTH_JWT_SECRET,
		AUTH_JWT_EXPIRATION: process.env.AUTH_JWT_EXPIRATION,
		AUTH_JWT_ALGORITHM: process.env.AUTH_JWT_ALGORITHM,
		AUTH_JWT_KEY_ID: process.env.AUTH_JWT_KEY_ID,
		GITHUB_ID: process.env.GITHUB_ID,
		GITHUB_SECRET: process.env.GITHUB_SECRET,
	},
	/**
	 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
	 * useful for Docker builds.
	 */
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	/**
	 * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
	 * `SOME_VAR=''` will throw an error.
	 */
	emptyStringAsUndefined: true,
})
