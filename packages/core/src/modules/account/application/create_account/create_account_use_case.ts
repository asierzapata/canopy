/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type {
	Provider,
	ProviderAccountId,
	UserId,
} from '@core/modules/account/domain/account'
import type { ModuleDependencies } from '../..'

type CreateAccountParameters = {
	userId: UserId
	provider: Provider
	providerAccountId: ProviderAccountId
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function createAccount(
	parameters: CreateAccountParameters,
	dependencies: ModuleDependencies,
) {
	return dependencies.repository.saveAccount({
		userId: parameters.userId,
		provider: parameters.provider,
		providerAccountId: parameters.providerAccountId,
		createdAt: new Date().getTime(),
		updatedAt: new Date().getTime(),
	})
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

async function authorizeCreateAccount(
	parameters: CreateAccountParameters,
	dependencies: ModuleDependencies,
	session: Session,
) {
	return
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export { createAccount, type CreateAccountParameters, authorizeCreateAccount }
