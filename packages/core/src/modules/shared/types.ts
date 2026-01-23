import type { Db } from 'mongodb'
import type { AuthenticationService } from '@core/services/authentication'

export type ModulesDependencies = {
	dataDb: Db
	userDb: Db
	authenticationService: AuthenticationService
}
