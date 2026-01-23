import crypto from 'crypto'

/**
 * Encodes a buffer to Base64URL format (URL-safe, no padding)
 * @param buffer The buffer to encode
 * @returns Base64URL encoded string
 */
function base64urlEncode(buffer: Buffer): string {
	return buffer
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=/g, '')
}

/**
 * Generates a cryptographically secure random token
 * @param length The number of random bytes to generate (default: 32)
 * @returns Base64URL encoded secure token
 *
 * @example
 * const token = generateSecureToken() // 43 characters for 32 bytes
 * const longerToken = generateSecureToken(64) // 86 characters for 64 bytes
 */
export function generateSecureToken(length: number = 32): string {
	const randomBytes = crypto.randomBytes(length)
	return base64urlEncode(randomBytes)
}
