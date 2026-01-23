import type { Id, User } from '../../domain/user'

export interface UserRepository {
	getUserById(id: Id): Promise<User | undefined | null>
	saveUser(user: Omit<User, 'id'> & { id?: Id }): Promise<void>
	generateId(): string
}
