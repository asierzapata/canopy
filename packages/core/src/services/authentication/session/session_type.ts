import _ from "lodash";

import { ApplicationError } from "@core/lib/application-error";

/* ====================================================== */
/*                       Exceptions                       */
/* ====================================================== */

class InvalidSessionTypeError extends ApplicationError {
	static readonly errorName =
		"menudo.1.error.authentication.invalid_session_type";

	static create({
		value,
		message = "Invalid session type",
		code = "invalid-session-type",
	}: {
		value: string;
		message?: string;
		code?: string;
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

const SESSION_TYPES = {
	UNAUTHENTICATED: "unauthenticated",
	AUTHENTICATED: "authenticated",
	ADMIN: "admin",
} as const;

const types = _.values(SESSION_TYPES);

export type SessionTypeValue = (typeof types)[number];

class SessionType {
	_value: (typeof types)[number];

	constructor(value = "") {
		if (!_.includes(types, value)) {
			throw InvalidSessionTypeError.create({
				value,
			});
		}
		this._value = value as (typeof types)[number];
	}

	// Named constructors
	// ------------------

	static unauthenticated() {
		return new this(SESSION_TYPES.UNAUTHENTICATED);
	}

	static authenticated() {
		return new this(SESSION_TYPES.AUTHENTICATED);
	}

	// Methods
	// -------

	isUnauthenticated() {
		return this._value === SESSION_TYPES.UNAUTHENTICATED;
	}

	isUser() {
		return this.isAdmin() || this.isAuthenticated();
	}

	isAuthenticated() {
		return this._value === SESSION_TYPES.AUTHENTICATED;
	}

	isAdmin() {
		return this._value === SESSION_TYPES.ADMIN;
	}

	toValue() {
		return this._value;
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export { SessionType, InvalidSessionTypeError };
