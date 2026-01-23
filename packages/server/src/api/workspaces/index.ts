import { Hono } from 'hono'
import { z } from 'zod'
import { generateDbId } from '@canopy/core'
import { successResponse } from '@/utils/response_factory'
import type { HonoAppType } from '@/app-type'
import { HTTPException } from 'hono/http-exception'

// Request validation schemas
const createWorkspaceSchema = z.object({
	name: z.string().min(1, 'Name is required'),
})

const addUserToWorkspaceSchema = z.object({
	userId: z.uuid(),
})

const workspaceParamSchema = z.object({
	workspaceId: z.uuid(),
})

const userParamSchema = z.object({
	userId: z.uuid(),
})

// Define types to match core module interfaces
interface CreateWorkspaceInput {
	name: string
	ownerId: string
}

interface AddUserToWorkspaceInput {
	workspaceId: string
	userId: string
}

// Parent: /api/workspaces
const app = new Hono<HonoAppType>()

// GET /api/workspaces/user/:userId - Get all workspaces for a user
app.get('/user/:userId', async c => {
	const params = userParamSchema.parse(c.req.param())
	const session = c.get('session')

	const workspaces = await c
		.get('modules')
		.workspace.getUserWorkspaces({ userId: params.userId }, session)

	return successResponse({
		c,
		statusCode: 200,
		data: workspaces,
	})
})

// GET /api/workspaces/:workspaceId - Get specific workspace by ID
app.get('/:workspaceId', async c => {
	const params = workspaceParamSchema.parse(c.req.param())
	const session = c.get('session')

	const workspace = await c
		.get('modules')
		.workspace.getWorkspaceById({ workspaceId: params.workspaceId }, session)

	return successResponse({
		c,
		statusCode: 200,
		data: workspace,
	})
})

// POST /api/workspaces - Create new workspace
app.post('/', async c => {
	let body: unknown
	try {
		body = await c.req.json()
	} catch {
		throw new HTTPException(400, { message: 'Invalid JSON body' })
	}

	try {
		// Parse with Zod and get properly typed data
		const data = createWorkspaceSchema.parse(body)
		const session = c.get('session')

		// Get authenticated user ID
		if (!session.isAuthenticated()) {
			throw new HTTPException(401, { message: 'Unauthenticated' })
		}

		const ownerId = session.getDistinctId()

		const createParams: CreateWorkspaceInput = {
			name: data.name,
			ownerId,
		}

		await c.get('modules').workspace.createWorkspace(createParams, session)

		// Since createWorkspace doesn't return the workspace, we need to get the workspaces for the user
		// and find the one we just created (this is not ideal, but works for testing)
		const userWorkspaces = await c
			.get('modules')
			.workspace.getUserWorkspaces({ userId: ownerId }, session)

		// Get the most recently created workspace (assuming it's the one we just created)
		const createdWorkspace = userWorkspaces.sort(
			(a, b) => b.createdAt - a.createdAt,
		)[0]

		return successResponse({
			c,
			statusCode: 201,
			data: createdWorkspace,
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new HTTPException(400, {
				message: `Invalid workspace data: ${error.message}`,
			})
		}
		throw error
	}
})

// POST /api/workspaces/:workspaceId/users - Add user to workspace
app.post('/:workspaceId/users', async c => {
	const params = workspaceParamSchema.parse(c.req.param())

	let body: unknown
	try {
		body = await c.req.json()
	} catch {
		throw new HTTPException(400, { message: 'Invalid JSON body' })
	}

	try {
		// Parse with Zod and get properly typed data
		const data = addUserToWorkspaceSchema.parse(body)
		const session = c.get('session')

		const addUserParams: AddUserToWorkspaceInput = {
			workspaceId: params.workspaceId,
			userId: data.userId,
		}

		await c.get('modules').workspace.addUserToWorkspace(addUserParams, session)

		// Fetch the updated workspace to return it
		const updatedWorkspace = await c
			.get('modules')
			.workspace.getWorkspaceById({ workspaceId: params.workspaceId }, session)

		return successResponse({
			c,
			statusCode: 200,
			data: updatedWorkspace,
		})
	} catch (error) {
		if (error instanceof z.ZodError) {
			throw new HTTPException(400, {
				message: `Invalid user data: ${error.message}`,
			})
		}
		throw error
	}
})

export default app
