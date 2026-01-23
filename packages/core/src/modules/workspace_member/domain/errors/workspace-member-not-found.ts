import { ApplicationError } from "@core/lib/application-error";

export class WorkspaceMemberNotFoundError extends ApplicationError {
	public static readonly errorName =
		"menudo.1.error.workspace_member.workspace_member_not_found";

	static create({
		message = "Workspace member not found",
		code = "workspace-member-not-found",
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
