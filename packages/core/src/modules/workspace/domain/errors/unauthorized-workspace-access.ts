import { ApplicationError } from "@core/lib/application-error";

export class UnauthorizedWorkspaceAccessError extends ApplicationError {
	public static readonly errorName =
		"menudo.1.error.workspace.unauthorized_workspace_access";

	static create({
		message = "Unauthorized workspace access",
		code = "unauthorized-workspace-access",
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
