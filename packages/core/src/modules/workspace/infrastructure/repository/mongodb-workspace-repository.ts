import { type WorkspaceRepository } from '.'
import {
	workspaceSchema,
	type Id,
	type Workspace,
} from '../../domain/workspace'
import { type Collection, type Db, UUID } from 'mongodb'

type DBWorkspace = Omit<Workspace, 'id'> & {
	_id: UUID
}

export function createMongoDBWorkspaceRepository({
	db,
}: {
	db: Db
}): WorkspaceRepository {
	const collection: Collection<DBWorkspace> = db.collection('workspaces')

	// Ensure indexes
	const ensureIndex = () => {
		// Create index on name for efficient searches
		collection.createIndex({ name: 1 })
		// Create index on userIds for efficient user workspace queries
		collection.createIndex({ userIds: 1 })
	}

	// Parse workspace from DB format to domain format
	const parseWorkspace = (workspace: DBWorkspace | null): Workspace | null => {
		if (!workspace) {
			return null
		}

		return workspaceSchema.parse({
			id: workspace._id.toString(),
			name: workspace.name,
			userIds: workspace.userIds,
			createdAt: workspace.createdAt,
			updatedAt: workspace.updatedAt,
		})
	}

	ensureIndex()

	return {
		async getWorkspaceById(id: string) {
			const response = await collection.findOne({
				_id: new UUID(id),
			})

			return parseWorkspace(response)
		},

		async saveWorkspace(workspace: Omit<Workspace, 'id'> & { id?: Id }) {
			await collection.insertOne({
				_id: workspace.id ? new UUID(workspace.id) : new UUID(),
				name: workspace.name,
				userIds: workspace.userIds,
				createdAt: workspace.createdAt,
				updatedAt: workspace.updatedAt,
			})
		},

		async getWorkspacesByUserId(userId: string) {
			const response = await collection
				.find({
					userIds: { $in: [userId] },
				})
				.toArray()

			return response
				.map(parseWorkspace)
				.filter((workspace): workspace is Workspace => workspace !== null)
		},

		async addUserToWorkspace(workspaceId: Id, userId: string) {
			await collection.updateOne(
				{ _id: new UUID(workspaceId) },
				{
					$addToSet: { userIds: userId },
					$set: { updatedAt: new Date().getTime() },
				},
			)
		},

		async removeUserFromWorkspace(workspaceId: Id, userId: string) {
			await collection.updateOne(
				{ _id: new UUID(workspaceId) },
				{
					$pull: { userIds: userId },
					$set: { updatedAt: new Date().getTime() },
				},
			)
		},

		generateId() {
			return new UUID().toHexString()
		},
	}
}
