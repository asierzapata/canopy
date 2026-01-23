import { type WorkspaceMemberRepository } from '.'
import {
	workspaceMemberSchema,
	type Id,
	type WorkspaceMember,
	type WorkspaceId,
	type UserId,
	type Role,
} from '../../domain/workspace-member'
import { type Collection, type Db, UUID } from 'mongodb'

type DBWorkspaceMember = Omit<WorkspaceMember, 'id'> & {
	_id: UUID
}

export function createMongoDBWorkspaceMemberRepository({
	db,
}: {
	db: Db
}): WorkspaceMemberRepository {
	const collection: Collection<DBWorkspaceMember> = db.collection('workspace_members')

	// Ensure indexes
	const ensureIndex = () => {
		// Index on workspaceId for efficient workspace member queries
		collection.createIndex({ workspaceId: 1 })
		// Index on userId for efficient user workspace queries
		collection.createIndex({ userId: 1 })
		// Compound unique index to prevent duplicate memberships
		collection.createIndex(
			{ workspaceId: 1, userId: 1 },
			{ unique: true }
		)
	}

	// Parse workspace member from DB format to domain format
	const parseWorkspaceMember = (member: DBWorkspaceMember | null): WorkspaceMember | null => {
		if (!member) {
			return null
		}

		return workspaceMemberSchema.parse({
			id: member._id.toString(),
			workspaceId: member.workspaceId,
			userId: member.userId,
			role: member.role,
			joinedAt: member.joinedAt,
			updatedAt: member.updatedAt,
		})
	}

	ensureIndex()

	return {
		async addMember(member: Omit<WorkspaceMember, 'id'> & { id?: Id }) {
			await collection.insertOne({
				_id: member.id ? new UUID(member.id) : new UUID(),
				workspaceId: member.workspaceId,
				userId: member.userId,
				role: member.role,
				joinedAt: member.joinedAt,
				updatedAt: member.updatedAt,
			})
		},

		async removeMember(workspaceId: WorkspaceId, userId: UserId) {
			await collection.deleteOne({
				workspaceId,
				userId,
			})
		},

		async getMembersByWorkspaceId(workspaceId: WorkspaceId) {
			const response = await collection
				.find({ workspaceId })
				.toArray()

			return response
				.map(parseWorkspaceMember)
				.filter((member): member is WorkspaceMember => member !== null)
		},

		async getMembersByUserId(userId: UserId) {
			const response = await collection
				.find({ userId })
				.toArray()

			return response
				.map(parseWorkspaceMember)
				.filter((member): member is WorkspaceMember => member !== null)
		},

		async getMember(workspaceId: WorkspaceId, userId: UserId) {
			const response = await collection.findOne({
				workspaceId,
				userId,
			})

			return parseWorkspaceMember(response)
		},

		async isMember(workspaceId: WorkspaceId, userId: UserId) {
			const count = await collection.countDocuments({
				workspaceId,
				userId,
			}, { limit: 1 })

			return count > 0
		},

		async updateMemberRole(workspaceId: WorkspaceId, userId: UserId, role: Role) {
			await collection.updateOne(
				{ workspaceId, userId },
				{
					$set: {
						role,
						updatedAt: Date.now(),
					},
				}
			)
		},

		generateId() {
			return new UUID().toHexString()
		},
	}
}
