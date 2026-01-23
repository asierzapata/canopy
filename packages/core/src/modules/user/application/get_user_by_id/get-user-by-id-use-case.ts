/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

import { UnauthenticatedError } from '@core/services/authentication/errors/unauthenticated_error'
import { CanNotAccessUserError } from '@core/modules/user/domain/errors/can-not-access-user'

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import type { Id } from '../../domain/user'
import type { ModuleDependencies } from '../..'

type GetUserByIdParameters = {
	userId: Id
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function getUserById(
	parameters: GetUserByIdParameters,
	dependencies: ModuleDependencies,
) {
	return dependencies.repository.getUserById(parameters.userId)
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

async function authorizeGetUserById(
	parameters: GetUserByIdParameters,
	dependencies: ModuleDependencies,
	session: Session,
) {
	if (!session.isAuthenticated()) {
		throw UnauthenticatedError.create()
	}

	if (session.isUserWithId(parameters.userId)) {
		throw CanNotAccessUserError.create()
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export { getUserById, type GetUserByIdParameters, authorizeGetUserById }
