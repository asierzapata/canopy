import { beforeEach, describe, expect, inject, test } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'

import { createUser, CreateUserParameters } from './create-user-use-case'
import { createMongoDBUserRepository } from '../../infrastructure/repository/mongodb-user-repository'
import { uuid } from '@core/services/uuid'
import { ModuleDependencies } from '../..'

describe('Use Case | Create User', () => {
	let db: Db
	let dependencies: ModuleDependencies
	let userParameters: CreateUserParameters

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'user', mongoUri })
		dependencies = {
			repository: createMongoDBUserRepository({ db }),
		}
		userParameters = {
			userId: uuid(),
			email: 'test@test.com',
			firstName: 'Test',
			lastName: 'User',
			picture: 'test-picture',
		}
	})

	test('should not return the new user', async () => {
		const user = await createUser(userParameters, dependencies)

		expect(user).toBeUndefined()
	})

	test('should save the new user on to the DB', async () => {
		await createUser(userParameters, dependencies)
		const user = await dependencies.repository.getUserById(
			userParameters.userId,
		)

		expect(user?.id).toEqual(userParameters.userId)
		expect(user?.firstName).toEqual(userParameters.firstName)
		expect(user?.lastName).toEqual(userParameters.lastName)
		expect(user?.picture).toEqual(userParameters.picture)
	})
})
