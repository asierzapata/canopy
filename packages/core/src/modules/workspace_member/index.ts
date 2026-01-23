import { createHandler } from "@core/lib/handler_factory";

import {
	authorizeCheckWorkspaceMembership,
	checkWorkspaceMembership,
} from "./application/check_workspace_membership/check-workspace-membership-use-case";
import {
	authorizeAddWorkspaceMember,
	addWorkspaceMember,
} from "./application/add_workspace_member/add-workspace-member-use-case";
import {
	authorizeRemoveWorkspaceMember,
	removeWorkspaceMember,
} from "./application/remove_workspace_member/remove-workspace-member-use-case";
import {
	authorizeGetWorkspaceMembers,
	getWorkspaceMembers,
} from "./application/get_workspace_members/get-workspace-members-use-case";
import {
	authorizeGetMemberWorkspaces,
	getMemberWorkspaces,
} from "./application/get_member_workspaces/get-member-workspaces-use-case";

import type { ModulesDependencies } from "@core/modules/shared/types";
import type { WorkspaceMemberRepository } from "./infrastructure/repository";

import { createMongoDBWorkspaceMemberRepository } from "./infrastructure/repository/mongodb-workspace-member-repository";
import { workspaceMemberSchema } from "./domain/workspace-member";

export type ModuleDependencies = {
	repository: WorkspaceMemberRepository;
};

const handlers = (dependencies: ModulesDependencies) => {
	const moduleDependencies = {
		...dependencies,
		...getModuleDependencies(dependencies),
	};

	return {
		checkWorkspaceMembership: createHandler({
			authorize: authorizeCheckWorkspaceMembership,
			handler: checkWorkspaceMembership,
			dependencies: moduleDependencies,
		}),
		addWorkspaceMember: createHandler({
			authorize: authorizeAddWorkspaceMember,
			handler: addWorkspaceMember,
			dependencies: moduleDependencies,
		}),
		removeWorkspaceMember: createHandler({
			authorize: authorizeRemoveWorkspaceMember,
			handler: removeWorkspaceMember,
			dependencies: moduleDependencies,
		}),
		getWorkspaceMembers: createHandler({
			authorize: authorizeGetWorkspaceMembers,
			handler: getWorkspaceMembers,
			dependencies: moduleDependencies,
		}),
		getMemberWorkspaces: createHandler({
			authorize: authorizeGetMemberWorkspaces,
			handler: getMemberWorkspaces,
			dependencies: moduleDependencies,
		}),
		entitySchema: workspaceMemberSchema,
	};
};

const getModuleDependencies = ({
	dataDb,
}: ModulesDependencies): ModuleDependencies => {
	return {
		repository: createMongoDBWorkspaceMemberRepository({ db: dataDb }),
	};
};

export default handlers;

// Export domain types
export type { WorkspaceMember, Role } from "./domain/workspace-member";

// Export errors
export { WorkspaceMemberNotFoundError } from "./domain/errors/workspace-member-not-found";
export { WorkspaceMemberAlreadyExistsError } from "./domain/errors/workspace-member-already-exists";
export { UnauthorizedWorkspaceMemberOperationError } from "./domain/errors/unauthorized-workspace-member-operation";

// Export repository interface
export type { WorkspaceMemberRepository } from "./infrastructure/repository";
