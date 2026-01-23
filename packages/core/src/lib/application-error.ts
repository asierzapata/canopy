import { uuid } from '../services/uuid'
import type { StatusCode } from './http-types'

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

const ERROR_TYPES = {
	PROGRAMMER: 'programmer',
	OPERATIONAL: 'operational',
} as const

type ErrorType = (typeof ERROR_TYPES)[keyof typeof ERROR_TYPES]

type ApplicationErrorAttributes = {
	statusCode: StatusCode
	code: string
	message: string
	stack: string | undefined
}

type ApplicationErrorMeta = Record<string, unknown>

class ApplicationError extends Error {
	static types = ERROR_TYPES

	id: string
	type: ErrorType
	version: number
	errorName: string
	occurredOn: string
	attributes: ApplicationErrorAttributes
	meta: ApplicationErrorMeta

	constructor({
		id = uuid(),
		type = ApplicationError.types.OPERATIONAL,
		occurredOn = new Date().toISOString(),
		version = 1,
		errorName,
		message,
		code,
		statusCode,
		error,
	}: {
		id?: string
		type?: ErrorType
		occurredOn?: string
		version?: number
		errorName: string
		message: string
		code: string
		statusCode: StatusCode
		error: Error
	}) {
		super(message)
		this.id = id
		this.type = type
		this.errorName = errorName
		this.version = version
		this.occurredOn = occurredOn
		this.attributes = {
			statusCode,
			code,
			message,
			stack: error.stack,
		}
		this.meta = {}
	}

	// Named constructors
	// ------------------

	static Operational({
		errorName,
		message,
		code,
		statusCode,
	}: {
		errorName: string
		message: string
		code: string
		statusCode: StatusCode
	}) {
		const error = new Error(message)

		return new this({
			type: ApplicationError.types.OPERATIONAL,
			errorName,
			message,
			code,
			statusCode,
			error,
		})
	}

	static Programmer({
		errorName,
		message,
		code,
	}: {
		errorName: string
		message: string
		code: string
	}) {
		const error = new Error(message)

		return new this({
			type: ApplicationError.types.PROGRAMMER,
			errorName,
			message,
			code,
			statusCode: 500,
			error,
		})
	}

	// Public methods
	// --------------

	addMetadata(meta: ApplicationErrorMeta) {
		this.meta = {
			...this.meta,
			...meta,
		}
	}
}

export { ApplicationError }
