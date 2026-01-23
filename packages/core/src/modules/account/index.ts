import { createHandler } from "@core/lib/handler_factory";

import {
	authorizeCreateAccount,
	createAccount,
} from "./application/create_account/create_account_use_case";
import {
	authorizeGetAccountByProviderAndProviderAccountId,
	getAccountByProviderAndProviderAccountId,
} from "./application/get_account_by_provider_and_provider_account_id/get_account_by_provider_and_provider_account_id_use_case";

import type { ModulesDependencies } from "@core/modules/shared/types";
import type { AccountRepository } from "./infrastructure/repository";

import { createMongoDBAccountRepository } from "./infrastructure/repository/mongodb_account_repository";
import { accountSchema } from "./domain/account";

export type ModuleDependencies = {
	repository: AccountRepository;
};

const handlers = (dependencies: ModulesDependencies) => {
	const moduleDependencies = {
		...dependencies,
		...getModuleDependencies(dependencies),
	};

	return {
		createAccount: createHandler({
			authorize: authorizeCreateAccount,
			handler: createAccount,
			dependencies: moduleDependencies,
		}),
		getAccountByProviderAndProviderAccountId: createHandler({
			authorize: authorizeGetAccountByProviderAndProviderAccountId,
			handler: getAccountByProviderAndProviderAccountId,
			dependencies: moduleDependencies,
		}),
		entitySchema: accountSchema,
	};
};

const getModuleDependencies = ({
	userDb,
}: ModulesDependencies): ModuleDependencies => {
	return {
		repository: createMongoDBAccountRepository({ db: userDb }),
	};
};

export default handlers;
