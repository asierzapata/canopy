import _ from "lodash";

import { ApplicationError } from "@core/lib/application-error";

/* ====================================================== */
/*                       Exceptions                       */
/* ====================================================== */

class InvalidSessionSourceError extends ApplicationError {
	static readonly errorName =
		"menudo.1.error.authentication.invalid_session_source";

	static create({
		value,
		message = "Invalid session source",
		code = "invalid-session-source",
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

const SESSION_SOURCES = {
	HTTP_REQUEST: "httpRequest",
	COMMAND_OR_QUERY: "commandOrQuery",
	EVENT: "event",
} as const;

const sources = _.values(SESSION_SOURCES);

export type SessionSourceValue = (typeof sources)[number];

class SessionSource {
	_value: (typeof sources)[number];

	constructor(value: string) {
		if (!_.includes(sources, value)) {
			throw InvalidSessionSourceError.create({
				value,
			});
		}
		this._value = value as (typeof sources)[number];
	}

	// Named constructors
	// ------------------

	static httpRequest() {
		return new this(SESSION_SOURCES.HTTP_REQUEST);
	}

	static commandOrQuery() {
		return new this(SESSION_SOURCES.COMMAND_OR_QUERY);
	}

	static event() {
		return new this(SESSION_SOURCES.EVENT);
	}

	// Methods
	// -------

	isHttpRequest() {
		return this._value === SESSION_SOURCES.HTTP_REQUEST;
	}

	isCommandOrQuery() {
		return this._value === SESSION_SOURCES.COMMAND_OR_QUERY;
	}

	isEvent() {
		return this._value === SESSION_SOURCES.EVENT;
	}

	toValue() {
		return this._value;
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export { SessionSource, InvalidSessionSourceError };
