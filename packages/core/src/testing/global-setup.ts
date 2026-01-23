import { TestProject } from 'vitest/node.js'
import { startTestDb, stopTestDb } from './db'

export async function setup(project: TestProject) {
	console.warn('Starting test database...')
	await startTestDb({ project })

	console.warn('Test database started')
	return async () => {
		console.warn('Stopping test database...')
		await stopTestDb()
	}
}
