import { env } from '@/env'
import { MongoClient, type TransactionOptions } from 'mongodb'

const uri = env.MONGODB_URI
const options = {}

declare global {
	// eslint-disable-next-line no-var
	var _mongoClientPromise: Promise<MongoClient>
}

class Singleton {
	private static _instance: Singleton
	private client: MongoClient
	private clientPromise: Promise<MongoClient>
	private constructor() {
		this.client = new MongoClient(uri, options)
		this.clientPromise = this.client.connect()
		if (env.NODE_ENV === 'development') {
			// In development mode, use a global variable so that the value
			// is preserved across module reloads caused by HMR (Hot Module Replacement).
			global._mongoClientPromise = this.clientPromise
		}
	}

	public static get instance() {
		if (!this._instance) {
			this._instance = new Singleton()
		}
		return this._instance.clientPromise
	}
}
const clientPromise = Singleton.instance

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise

export const transaction = async <T>(
	callback: (client: MongoClient) => Promise<T>,
): Promise<T> => {
	const client = await clientPromise

	const transactionOptions = {
		readPreference: 'primary',
		readConcern: { level: 'snapshot' },
		writeConcern: { w: 'majority' },
	} satisfies TransactionOptions

	const session = client.startSession()

	try {
		return await session.withTransaction(async () => {
			return await callback(client)
		}, transactionOptions)
	} finally {
		session.endSession()
	}
}
