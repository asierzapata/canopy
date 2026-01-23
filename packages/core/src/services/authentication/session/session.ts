import _ from "lodash";

import { uuid } from "@core/services/uuid";
import { ApplicationError } from "@core/lib/application-error";

import { SessionType, type SessionTypeValue } from "./session_type";
import { SessionSource, type SessionSourceValue } from "./session_source";
import {
	SessionAuthorizationStatus,
	type SessionAuthorizationStatusValue,
} from "./session_authorization_status";
import { SessionDevice, type SessionDeviceValue } from "./session_device";

/* ====================================================== */
/*                       Exceptions                       */
/* ====================================================== */

class InvalidSessionError extends ApplicationError {
	static readonly errorName = "menudo.1.error.authentication.invalid_session";

	static create({
		message = "Invalid session",
		code = "invalid-session",
		value,
	}: {
		message?: string;
		code?: string;
		value: unknown;
	}) {
		return this.Operational({
			errorName: this.errorName,
			message: `${String(value)} - ${message}`,
			code,
			statusCode: 400,
		});
	}
}

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

class Session {
	_value: {
		id: string;
		type: SessionType;
		distinctId: string;
		roles: string[];
		registeredAt?: Date;
		source?: SessionSource;
		device?: SessionDevice;
		authorizationStatus?: SessionAuthorizationStatus;
	};

	constructor({
		id = uuid(),
		type,
		distinctId,
		roles = [],
		registeredAt,
		source,
		device = {},
		authorizationStatus = SessionAuthorizationStatus.unauthorized().toValue(),
	}: {
		id?: string;
		type: SessionTypeValue;
		distinctId: string;
		roles?: string[];
		registeredAt?: Date;
		source?: SessionSourceValue;
		device?: SessionDeviceValue;
		authorizationStatus?: SessionAuthorizationStatusValue;
	}) {
		const data = {
			id,
			type: new SessionType(type),
			distinctId,
			roles,
			source: source ? new SessionSource(source) : undefined,
			device: device ? new SessionDevice(device) : undefined,
			authorizationStatus: new SessionAuthorizationStatus(authorizationStatus),
			registeredAt,
		};
		if (new SessionType(type).isUser() && _.isEmpty(distinctId)) {
			throw InvalidSessionError.create({ value: data });
		}
		this._value = data;
	}

	// Named constructors
	// ------------------

	static unauthenticated({
		id = uuid(),
		device,
		source,
	}: {
		id?: string;
		device?: SessionDeviceValue;
		source?: SessionSourceValue;
	} = {}) {
		return new this({
			id,
			type: SessionType.unauthenticated().toValue(),
			distinctId: "",
			roles: [],
			source,
			device,
			authorizationStatus: SessionAuthorizationStatus.unauthorized().toValue(),
		});
	}

	static user({
		distinctId,
		device = SessionDevice.undetectable().toValue(),
		source,
	}: {
		distinctId: string;
		device?: SessionDeviceValue;
		source?: SessionSourceValue;
	}) {
		return new this({
			type: SessionType.authenticated().toValue(),
			distinctId,
			roles: [`user-${distinctId}`],
			source,
			device,
			authorizationStatus: SessionAuthorizationStatus.unauthorized().toValue(),
		});
	}

	static fromEvent(session: Session) {
		return new this({
			type: session._value.type.toValue(),
			distinctId: session._value.distinctId,
			registeredAt: session._value.registeredAt,
			source: SessionSource.event().toValue(),
			device: session._value.device?.toValue(),
		});
	}

	// Methods
	// -------

	isAuthenticated() {
		return this._value.type.isAuthenticated();
	}

	getType() {
		return this._value.type;
	}

	getDistinctId() {
		return this._value.distinctId;
	}

	getRoles() {
		return this._value.roles;
	}

	isFromEvent() {
		return this._value.source?.isEvent() ?? false;
	}

	isUserWithId(userId: string) {
		return this.getDistinctId() === userId;
	}

	toValue() {
		return {
			id: this._value.id,
			type: this._value.type.toValue(),
			distinctId: this._value.distinctId,
			roles: this._value.roles,
			registeredAt: this._value.registeredAt,
			source: this._value.source?.toValue(),
			device: this._value.device?.toValue(),
			authorizationStatus: this._value.authorizationStatus?.toValue(),
		};
	}

	// Methods - Device
	// ----------------

	getDevice() {
		return this._value.device;
	}

	// Methods - Authorization
	// -----------------------

	isUnauthorized() {
		return this._value.authorizationStatus?.isUnauthorized() ?? true;
	}

	isAuthorizing() {
		return this._value.authorizationStatus?.isAuthorizing() ?? false;
	}

	isAuthorized() {
		return this._value.authorizationStatus?.isAuthorized() ?? false;
	}

	setAsAuthorizing() {
		this._value.authorizationStatus = SessionAuthorizationStatus.authorizing();
	}

	setAsAuthorized() {
		this._value.authorizationStatus = SessionAuthorizationStatus.authorized();
	}

	getAuthorizationStatus() {
		return this._value.authorizationStatus;
	}
}

/* ====================================================== */
/*                        Public API                      */
/* ====================================================== */

export { Session, InvalidSessionError };
