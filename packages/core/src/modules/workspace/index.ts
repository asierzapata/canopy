import { createHandler } from "@core/lib/handler_factory";

import {
	authorizeCreateWorkspace,
	createWorkspace,
} from "./application/create_workspace/create-workspace-use-case";
import {
	authorizeGetWorkspaceById,
	getWorkspaceById,
} from "./application/get_workspace_by_id/get-workspace-by-id-use-case";
import {
	authorizeGetUserWorkspaces,
	getUserWorkspaces,
} from "./application/get_user_workspaces/get-user-workspaces-use-case";
import {
	authorizeAddUserToWorkspace,
	addUserToWorkspace,
} from "./application/add_user_to_workspace/add-user-to-workspace-use-case";

import type { ModulesDependencies } from "@core/modules/shared/types";
import type { WorkspaceRepository } from "./infrastructure/repository";
import type { WorkspaceMemberRepository } from "@core/modules/workspace_member/infrastructure/repository";

import { createMongoDBWorkspaceRepository } from "./infrastructure/repository/mongodb-workspace-repository";
import { createMongoDBWorkspaceMemberRepository } from "@core/modules/workspace_member/infrastructure/repository/mongodb-workspace-member-repository";
import { workspaceSchema } from "./domain/workspace";

export type ModuleDependencies = {
	repository: WorkspaceRepository;
	workspaceMemberRepository: WorkspaceMemberRepository;
};

const handlers = (dependencies: ModulesDependencies) => {
	const moduleDependencies = {
		...dependencies,
		...getModuleDependencies(dependencies),
	};

	return {
		createWorkspace: createHandler({
			authorize: authorizeCreateWorkspace,
			handler: createWorkspace,
			dependencies: moduleDependencies,
		}),
		getWorkspaceById: createHandler({
			authorize: authorizeGetWorkspaceById,
			handler: getWorkspaceById,
			dependencies: moduleDependencies,
		}),
		getUserWorkspaces: createHandler({
			authorize: authorizeGetUserWorkspaces,
			handler: getUserWorkspaces,
			dependencies: moduleDependencies,
		}),
		addUserToWorkspace: createHandler({
			authorize: authorizeAddUserToWorkspace,
			handler: addUserToWorkspace,
			dependencies: moduleDependencies,
		}),
		entitySchema: workspaceSchema,
	};
};

const getModuleDependencies = ({
	dataDb,
}: ModulesDependencies): ModuleDependencies => {
	return {
		repository: createMongoDBWorkspaceRepository({ db: dataDb }),
		workspaceMemberRepository: createMongoDBWorkspaceMemberRepository({ db: dataDb }),
	};
};

export default handlers;
