import { Hono } from 'hono'
import { logger } from 'hono/logger'
import { requestId } from 'hono/request-id'
import { secureHeaders } from 'hono/secure-headers'
import { dependencyInjectionMiddleware } from './middleware/dependency-injection.middleware'
import apiApp from './api'

import type { HonoAppType } from '@/app-type'
import { authenticationMiddleware } from './middleware/authentication.middleware'
import { errorResponse } from './utils/response_factory'

const app = new Hono<HonoAppType>()

app.use(logger())
app.use(secureHeaders())
app.use('*', requestId())
app.use('*', dependencyInjectionMiddleware)
app.use('*', authenticationMiddleware)

app.route('/api', apiApp)

app.onError((err, c) => {
	// Log the error
	console.error(err)

	return errorResponse({
		c,
		err,
	})
})

 export default app
