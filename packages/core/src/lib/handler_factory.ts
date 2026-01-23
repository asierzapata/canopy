import type { Session } from '@core/services/authentication/session/session'

type HandlerAuthorization<P, D> = (
	parameters: P,
	dependencies: D,
	session: Session,
) => Promise<void> | void

export const createHandler = <P, D, R>({
	authorize,
	handler,
	dependencies,
}: {
	authorize: HandlerAuthorization<P, D>
	handler: (parameters: P, dependencies: D) => Promise<R>
	dependencies: D
}) => {
	return async (parameters: P, session: Session | null) => {
		if (!session?.isAuthorized) {
			await authorize(parameters, dependencies, session!)
		}
		return handler(parameters, dependencies)
	}
}
