import { ApplicationError } from "@core/lib/application-error";

export class UnauthorizedWorkspaceMemberOperationError extends ApplicationError {
	public static readonly errorName =
		"menudo.1.error.workspace_member.unauthorized_workspace_member_operation";

	static create({
		message = "Unauthorized workspace member operation",
		code = "unauthorized-workspace-member-operation",
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
