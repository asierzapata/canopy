/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

import type { Session } from '@core/services/authentication/session/session'
import {
	type Email,
	type FirstName,
	type Id,
	type LastName,
	type Picture,
} from '@core/modules/user/domain/user'
import type { ModuleDependencies } from '../..'

type CreateUserParameters = {
	userId: Id
	email?: Email
	firstName: FirstName
	lastName: LastName
	picture: Picture
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

async function createUser(
	{ userId, ...parameters }: CreateUserParameters,
	dependencies: ModuleDependencies,
) {
	const user = await dependencies.repository.saveUser({
		id: userId,
		createdAt: new Date().getTime(),
		updatedAt: new Date().getTime(),
		...parameters,
	})

	return user
}

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

function authorizeCreateUser(
	_parameters: CreateUserParameters,
	_dependencies: ModuleDependencies,
	_session: Session,
) {
	return
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export { createUser, type CreateUserParameters, authorizeCreateUser }
