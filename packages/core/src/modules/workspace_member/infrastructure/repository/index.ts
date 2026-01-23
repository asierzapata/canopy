import type { Id, WorkspaceMember, WorkspaceId, UserId, Role } from '../../domain/workspace-member'

export interface WorkspaceMemberRepository {
	addMember(member: Omit<WorkspaceMember, 'id'> & { id?: Id }): Promise<void>
	removeMember(workspaceId: WorkspaceId, userId: UserId): Promise<void>
	getMembersByWorkspaceId(workspaceId: WorkspaceId): Promise<WorkspaceMember[]>
	getMembersByUserId(userId: UserId): Promise<WorkspaceMember[]>
	getMember(workspaceId: WorkspaceId, userId: UserId): Promise<WorkspaceMember | null>
	isMember(workspaceId: WorkspaceId, userId: UserId): Promise<boolean>
	updateMemberRole(workspaceId: WorkspaceId, userId: UserId, role: Role): Promise<void>
	generateId(): string
}
