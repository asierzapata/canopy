import { createHandler } from "@core/lib/handler_factory";

import {
	authorizeCreateUser,
	createUser,
} from "./application/create_user/create-user-use-case";
import {
	authorizeGetUserById,
	getUserById,
} from "./application/get_user_by_id/get-user-by-id-use-case";

import type { ModulesDependencies } from "@core/modules/shared/types";
import type { UserRepository } from "./infrastructure/repository";

import { createMongoDBUserRepository } from "./infrastructure/repository/mongodb-user-repository";
import { userSchema } from "./domain/user";

export type ModuleDependencies = {
	repository: UserRepository;
};

const handlers = (dependencies: ModulesDependencies) => {
	const moduleDependencies = {
		...dependencies,
		...getModuleDependencies(dependencies),
	};

	return {
		createUser: createHandler({
			authorize: authorizeCreateUser,
			handler: createUser,
			dependencies: moduleDependencies,
		}),
		getUserById: createHandler({
			authorize: authorizeGetUserById,
			handler: getUserById,
			dependencies: moduleDependencies,
		}),
		entitySchema: userSchema,
	};
};

const getModuleDependencies = ({
	userDb,
}: ModulesDependencies): ModuleDependencies => {
	return {
		repository: createMongoDBUserRepository({ db: userDb }),
	};
};

export default handlers;
