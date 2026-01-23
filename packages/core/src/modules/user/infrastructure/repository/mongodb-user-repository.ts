import { type UserRepository } from '.'
import { userSchema, type Id, type User } from '../../domain/user'
import { type Collection, type Db, UUID } from 'mongodb'

type DBUser = Omit<User, 'id'> & {
	_id: UUID
}

export function createMongoDBUserRepository({
	db,
}: {
	db: Db
}): UserRepository {
	const collection: Collection<DBUser> = db.collection('users')

	// Ensure indexes
	const ensureIndex = () => {
		// Create index on email for uniqueness
		collection.createIndex({ email: 1 }, { unique: true })
	}

	// Parse user from DB format to domain format
	const parseUser = (user: DBUser | null): User | null => {
		if (!user) {
			return null
		}

		return userSchema.parse({
			id: user._id.toString(),
			firstName: user.firstName,
			lastName: user.lastName,
			picture: user.picture,
			email: user.email,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		})
	}

	ensureIndex()

	return {
		async getUserById(id: string) {
			const response = await collection.findOne({
				_id: new UUID(id),
			})

			return parseUser(response)
		},

		async saveUser(user: Omit<User, 'id'> & { id?: Id }) {
			await collection.insertOne({
				_id: user.id ? new UUID(user.id) : new UUID(),
				firstName: user.firstName,
				lastName: user.lastName,
				picture: user.picture,
				email: user.email,
				createdAt: user.createdAt,
				updatedAt: user.updatedAt,
			})
		},

		generateId() {
			return new UUID().toHexString()
		},
	}
}
