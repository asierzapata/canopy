import { ApplicationError } from "@core/lib/application-error";

export class CanNotAccessUserError extends ApplicationError {
	public static readonly errorName = "menudo.1.error.user.can_not_access_user";

	static create({
		message = "Can not access user",
		code = "can-not-access-user",
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
