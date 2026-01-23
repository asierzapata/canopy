import { ApplicationError } from "@core/lib/application-error";

export class WorkspaceNotFoundError extends ApplicationError {
	public static readonly errorName =
		"menudo.1.error.workspace.workspace_not_found";

	static create({
		message = "Workspace not found",
		code = "workspace-not-found",
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
