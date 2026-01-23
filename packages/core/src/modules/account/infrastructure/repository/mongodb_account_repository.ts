import {
	type AccountRepository,
	type GetAccountByProviderAndProviderAccountIdParameters,
} from '.'
import { accountSchema, type Account } from '../../domain/account'

import { type Collection, type Db, UUID } from 'mongodb'

type DBAccount = Omit<Account, 'id' | 'userId'> & {
	_id: UUID
	userId: UUID
}

function createMongoDBAccountRepository({ db }: { db: Db }): AccountRepository {
	const collection: Collection<DBAccount> = db.collection('accounts')

	// Ensure index on initialization
	ensureIndex()

	function ensureIndex() {
		collection.createIndex(
			{ provider: 1, providerAccountId: 1 },
			{ unique: true, background: true },
		)
	}

	function parseAccount(account: DBAccount | null): Account | null {
		if (!account) {
			return null
		}

		return accountSchema.parse({
			id: account._id.toString(),
			userId: account.userId.toString(),
			provider: account.provider,
			providerAccountId: account.providerAccountId,
			refreshToken: account.refreshToken,
			accessToken: account.accessToken,
			expiresAt: account.expiresAt,
			tokenType: account.tokenType,
			createdAt: account.createdAt,
			updatedAt: account.updatedAt,
		})
	}

	async function getAccountByProviderAndProviderAccountId({
		provider,
		providerAccountId,
	}: GetAccountByProviderAndProviderAccountIdParameters) {
		const response = await collection.findOne({
			provider,
			providerAccountId,
		})

		return parseAccount(response)
	}

	async function saveAccount(account: Account) {
		collection.insertOne({
			_id: new UUID(account.id),
			userId: new UUID(account.userId),
			provider: account.provider,
			providerAccountId: account.providerAccountId,
			refreshToken: account.refreshToken,
			accessToken: account.accessToken,
			expiresAt: account.expiresAt,
			tokenType: account.tokenType,
			createdAt: account.createdAt,
			updatedAt: account.updatedAt,
		})
	}

	return {
		getAccountByProviderAndProviderAccountId,
		saveAccount,
	}
}

export { createMongoDBAccountRepository }
