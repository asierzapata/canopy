import { beforeEach, describe, expect, inject, test } from 'vitest'
import { Db } from 'mongodb'
import { getDb } from '@core/testing/db'

import { getUserById, GetUserByIdParameters } from './get-user-by-id-use-case'
import { createMongoDBUserRepository } from '../../infrastructure/repository/mongodb-user-repository'
import { uuid } from '@core/services/uuid'
import { ModuleDependencies } from '../..'

describe('Use Case | Get User By Id', () => {
	let db: Db
	let dependencies: ModuleDependencies
	let userId: GetUserByIdParameters['userId']
	let savedUser: Parameters<typeof dependencies.repository.saveUser>['0']

	beforeEach(async () => {
		const mongoUri = inject('mongoUri')
		db = await getDb({ dbName: 'user', mongoUri })
		dependencies = {
			repository: createMongoDBUserRepository({ db }),
		}
		userId = uuid()
		savedUser = {
			id: userId,
			email: 'test@test.com',
			firstName: 'Test',
			lastName: 'User',
			picture: 'test-picture',
			createdAt: new Date().getTime(),
			updatedAt: new Date().getTime(),
		}
		await dependencies.repository.saveUser(savedUser)
	})

	test('should return the requested user', async () => {
		const user = await getUserById({ userId }, dependencies)

		expect(user).toBeDefined()
		expect(user?.id).toEqual(savedUser.id)
		expect(user?.firstName).toEqual(savedUser.firstName)
		expect(user?.lastName).toEqual(savedUser.lastName)
		expect(user?.picture).toEqual(savedUser.picture)
		expect(user?.email).toEqual(savedUser.email)
		expect(user?.createdAt).toEqual(savedUser.createdAt)
		expect(user?.updatedAt).toEqual(savedUser.updatedAt)
	})
})
