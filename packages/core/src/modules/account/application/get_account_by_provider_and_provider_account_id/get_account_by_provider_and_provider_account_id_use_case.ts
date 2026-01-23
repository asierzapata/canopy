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
} from '@core/modules/account/domain/account'
import type { ModuleDependencies } from '../..'

type GetAccountByProviderAndProviderAccountIdParameters = {
	provider: Provider
	providerAccountId: ProviderAccountId
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function getAccountByProviderAndProviderAccountId(
	parameters: GetAccountByProviderAndProviderAccountIdParameters,
	dependencies: ModuleDependencies,
) {
	return dependencies.repository.getAccountByProviderAndProviderAccountId({
		provider: parameters.provider,
		providerAccountId: parameters.providerAccountId,
	})
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

async function authorizeGetAccountByProviderAndProviderAccountId(
	parameters: GetAccountByProviderAndProviderAccountIdParameters,
	dependencies: ModuleDependencies,
	session: Session,
) {
	return
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export {
	getAccountByProviderAndProviderAccountId,
	type GetAccountByProviderAndProviderAccountIdParameters,
	authorizeGetAccountByProviderAndProviderAccountId,
}
