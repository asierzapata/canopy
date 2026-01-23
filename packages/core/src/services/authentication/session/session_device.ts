import { detect } from 'detect-browser'

/* ====================================================== */
/*                       Exceptions                       */
/* ====================================================== */

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

const platforms = {
	BROWSER: 'browser',
	UNKNOWN: 'unknown',
}

export type SessionDeviceValue = {
	userAgent?: string
	platform?: string
	name?: string
	version?: string
	os?: string
	screenWidth?: number | null
	screenHeight?: number | null
}

class SessionDevice {
	_value: SessionDeviceValue

	constructor({
		userAgent = '',
		platform = '',
		name = '',
		version = '',
		os = '',
		screenWidth = null,
		screenHeight = null,
	}: SessionDeviceValue = {}) {
		this._value = {
			userAgent,
			platform,
			name,
			version,
			os,
			screenWidth,
			screenHeight,
		}
	}

	// Named constructors
	// ------------------

	static browserUserAgent({
		userAgent = '',
		screenWidth = null,
		screenHeight = null,
	}: {
		userAgent?: string
		screenWidth?: string | null
		screenHeight?: string | null
	}) {
		if (!userAgent) {
			return new this({
				userAgent: '',
				platform: platforms.BROWSER,
				name: '',
				version: '',
				os: '',
				screenWidth: screenWidth ? parseInt(screenWidth, 10) : null,
				screenHeight: screenHeight ? parseInt(screenHeight, 10) : null,
			})
		}
		const browser = detect(userAgent)
		if (!browser) {
			return new this({
				userAgent,
				platform: platforms.BROWSER,
				screenWidth: screenWidth ? parseInt(screenWidth, 10) : null,
				screenHeight: screenHeight ? parseInt(screenHeight, 10) : null,
			})
		}
		return new this({
			userAgent,
			platform: platforms.BROWSER,
			name: browser.name,
			version: browser.version ?? '',
			os: browser.os ?? '',
			screenWidth: screenWidth ? parseInt(screenWidth, 10) : null,
			screenHeight: screenHeight ? parseInt(screenHeight, 10) : null,
		})
	}

	static undetectable() {
		return new this({
			userAgent: '',
			platform: '',
			name: '',
			version: '',
			os: '',
			screenWidth: null,
			screenHeight: null,
		})
	}

	// Methods
	// -------

	isDetected() {
		return !!this._value.platform
	}

	toValue() {
		return this._value
	}
}

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */

export { SessionDevice }
