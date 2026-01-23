import { modules, type Modules, type ModulesFactory } from "./modules";

import {
	createAuthenticationService,
	type AuthenticationService,
} from "./services/authentication";
import { Session } from "./services/authentication/session/session";
import { SessionAuthorizationStatus } from "./services/authentication/session/session_authorization_status";
import { SessionDevice } from "./services/authentication/session/session_device";
import { SessionType } from "./services/authentication/session/session_type";

import { ApplicationError } from "./lib/application-error";
import { generateDbId } from "./utils/id";

export type { Modules, ModulesFactory, AuthenticationService };

export {
	modules,
	createAuthenticationService,
	Session,
	SessionAuthorizationStatus,
	SessionDevice,
	SessionType,
	ApplicationError,
	generateDbId,
};
