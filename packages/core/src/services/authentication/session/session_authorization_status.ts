import _ from "lodash";
import { ApplicationError } from "@core/lib/application-error";

/* ====================================================== */
/*                       Exceptions                       */
/* ====================================================== */

class InvalidSessionAuthorizationStatusError extends ApplicationError {
	static readonly errorName =
		"menudo.1.error.authentication.invalid_session_authorization_status";

	static create({
		message = "Invalid session authorization status",
		code = "invalid-session-authorization-status",
		value,
	}: {
		message?: string;
		code?: string;
		value: string;
	}) {
		return this.Operational({
			errorName: this.errorName,
			message: `${value} - ${message}`,
			code,
			statusCode: 400,
		});
	}
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

const SESSION_AUTHORIZATION_STATUSES = {
	UNAUTHORIZED: "unauthorized",
	AUTHORIZING: "authorizing",
	AUTHORIZED: "authorized",
} as const;

const statuses = _.values(SESSION_AUTHORIZATION_STATUSES);

export type SessionAuthorizationStatusValue = (typeof statuses)[number];

class SessionAuthorizationStatus {
	_value: (typeof statuses)[number];

	constructor(value: (typeof statuses)[number]) {
		if (!statuses.includes(value)) {
			throw InvalidSessionAuthorizationStatusError.create({ value });
		}
		this._value = value;
	}

	// Named constructors
	// ------------------

	static unauthorized() {
		return new this(SESSION_AUTHORIZATION_STATUSES.UNAUTHORIZED);
	}

	static authorizing() {
		return new this(SESSION_AUTHORIZATION_STATUSES.AUTHORIZING);
	}

	static authorized() {
		return new this(SESSION_AUTHORIZATION_STATUSES.AUTHORIZED);
	}

	// Methods
	// -------

	isUnauthorized() {
		return this._value === SESSION_AUTHORIZATION_STATUSES.UNAUTHORIZED;
	}

	isAuthorizing() {
		return this._value === SESSION_AUTHORIZATION_STATUSES.AUTHORIZING;
	}

	isAuthorized() {
		return this._value === SESSION_AUTHORIZATION_STATUSES.AUTHORIZED;
	}

	toValue() {
		return this._value;
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export { SessionAuthorizationStatus, InvalidSessionAuthorizationStatusError };
