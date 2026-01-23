import { ApplicationError } from "@core/lib/application-error";

export class WorkspaceMemberAlreadyExistsError extends ApplicationError {
	public static readonly errorName =
		"menudo.1.error.workspace_member.workspace_member_already_exists";

	static create({
		message = "Workspace member already exists",
		code = "workspace-member-already-exists",
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
