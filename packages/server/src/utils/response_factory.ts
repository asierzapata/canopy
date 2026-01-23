import { ApplicationError } from '@canopy/core'
import type { Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { StatusCode } from 'hono/utils/http-status'

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export { successResponse, errorResponse }

/* ====================================================== */
/*                   Implementation                       */
/* ====================================================== */

export type SuccessResponse<D, M> = {
	data: D
	meta: M
}

function successResponse<D, M>({
	c,
	statusCode,
	data,
	meta,
}: {
	c: Context
	statusCode: StatusCode
	data?: D
	meta?: M
}) {
	c.status(statusCode)

	console.log('Success Response:', {
		statusCode,
		data,
		meta,
		condition: !data && !meta,
	})

	if (!data && !meta) {
		return c.body(null)
	}

	return c.json({
		data,
		meta,
	})
}

function errorResponse({ c, err }: { c: Context; err: Error }) {
	let statusCode: StatusCode = 500
	let meta = {}
	let error = {} as { code: string; message: string }

	if (err instanceof HTTPException) {
		statusCode = err.status
		error = {
			code: 'api-exception',
			message: err.message,
		}
	}

	if (err instanceof ApplicationError) {
		statusCode = err.attributes.statusCode
		error = {
			code: err.attributes.code,
			message: err.attributes.message,
		}
		meta = err.meta
	}

	if (!error.code || !error.message) {
		error = {
			code: 'internal-server-error',
			message: 'Internal server error',
		}
	}

	c.status(statusCode)

	return c.json({
		error,
		meta,
	})
}
