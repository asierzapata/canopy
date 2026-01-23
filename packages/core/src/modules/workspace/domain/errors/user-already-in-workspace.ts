import { ApplicationError } from "@core/lib/application-error";

export class UserAlreadyInWorkspaceError extends ApplicationError {
	public static readonly errorName =
		"menudo.1.error.workspace.user_already_in_workspace";

	static create({
		message = "User already in workspace",
		code = "user-already-in-workspace",
	}: {
		message?: string;
		code?: string;
	} = {}) {
		return this.Operational({
			errorName: this.errorName,
			message,
			code,
			statusCode: 409,
		});
	}
}
