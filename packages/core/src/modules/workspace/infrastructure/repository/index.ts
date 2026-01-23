import type { Id, Workspace } from '../../domain/workspace'

export interface WorkspaceRepository {
	getWorkspaceById(id: Id): Promise<Workspace | undefined | null>
	saveWorkspace(workspace: Omit<Workspace, 'id'> & { id?: Id }): Promise<void>
	getWorkspacesByUserId(userId: string): Promise<Workspace[]>
	addUserToWorkspace(workspaceId: Id, userId: string): Promise<void>
	removeUserFromWorkspace(workspaceId: Id, userId: string): Promise<void>
	generateId(): string
}
