import { MongoMemoryServer } from 'mongodb-memory-server'
import { MongoClient } from 'mongodb'
import { TestProject } from 'vitest/node.js'

let mongoMemoryServer: MongoMemoryServer | null
let client: MongoClient | null

export async function startTestDb({ project }: { project: TestProject }) {
	mongoMemoryServer = await MongoMemoryServer.create()
	const uri = mongoMemoryServer.getUri()

	project.provide('mongoUri', uri)
}

export async function stopTestDb() {
	console.warn('Stopping test database...')
	if (!mongoMemoryServer) return
	await mongoMemoryServer.stop()
	mongoMemoryServer = null
	client = null
}

export async function getDb({
	dbName = 'test',
	mongoUri,
}: {
	dbName: string
	mongoUri: string
}) {
	client = new MongoClient(mongoUri)
	await client.connect()
	return client.db(dbName)
}

declare module 'vitest' {
	export interface ProvidedContext {
		mongoUri: string
	}
}
