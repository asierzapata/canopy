import { Hono } from 'hono'
import authApp from './auth'
import workspacesApp from './workspaces'

import type { HonoAppType } from '@/app-type'

const app = new Hono<HonoAppType>()

app.route('/auth', authApp)
app.route('/workspaces', workspacesApp)

export default app
