import { ApplicationError } from "@core/lib/application-error";

export class UnauthenticatedError extends ApplicationError {
	public static readonly errorName =
		"menudo.1.error.authentication.unauthenticated";

	static create({
		message = "Unauthenticated",
		code = "unauthenticated",
	}: {
		message?: string;
		code?: string;
	} = {}) {
		return this.Operational({
			errorName: this.errorName,
			message,
			code,
			statusCode: 403,
		});
	}
}
