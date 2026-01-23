import { ApplicationError } from "@core/lib/application-error";

export class UserNotInWorkspaceError extends ApplicationError {
	public static readonly errorName =
		"menudo.1.error.workspace.user_not_in_workspace";

	static create({
		message = "User not in workspace",
		code = "user-not-in-workspace",
	}: {
		message?: string;
		code?: string;
	} = {}) {
		return this.Operational({
			errorName: this.errorName,
			message,
			code,
			statusCode: 404,
		});
	}
}
