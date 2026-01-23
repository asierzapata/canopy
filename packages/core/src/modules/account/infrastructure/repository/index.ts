import {
	type Account,
	type Provider,
	type ProviderAccountId,
} from '../../domain/account'

export type GetAccountByProviderAndProviderAccountIdParameters = {
	provider: Provider
	providerAccountId: ProviderAccountId
}

export interface AccountRepository {
	getAccountByProviderAndProviderAccountId({
		provider,
		providerAccountId,
	}: GetAccountByProviderAndProviderAccountIdParameters): Promise<
		Account | undefined | null
	>
	saveAccount(account: Omit<Account, 'id'>): Promise<void>
}
