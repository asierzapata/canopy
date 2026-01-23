import { describe, expect, test } from 'vitest'
import { generateSecureToken } from './token.service'

describe('Token Service', () => {
	describe('generateSecureToken', () => {
		test('should generate a token with default length (32 bytes = 43 chars)', () => {
			const token = generateSecureToken()

			// 32 bytes encoded in base64url produces 43 characters
			// (32 bytes * 8 bits/byte) / 6 bits per base64 char = 42.67 -> 43 chars
			expect(token).toHaveLength(43)
		})

		test('should generate unique tokens', () => {
			const tokens = new Set<string>()
			const iterations = 1000

			for (let i = 0; i < iterations; i++) {
				const token = generateSecureToken()
				tokens.add(token)
			}

			// All tokens should be unique
			expect(tokens.size).toBe(iterations)
		})

		test('should only contain URL-safe characters (base64url)', () => {
			const token = generateSecureToken()

			// Base64url should not contain +, /, or = characters
			expect(token).not.toContain('+')
			expect(token).not.toContain('/')
			expect(token).not.toContain('=')

			// Should only contain alphanumeric, hyphen, and underscore
			expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
		})

		test('should respect custom length parameter', () => {
			const token16 = generateSecureToken(16)
			const token64 = generateSecureToken(64)

			// 16 bytes = 22 chars, 64 bytes = 86 chars in base64url
			expect(token16).toHaveLength(22)
			expect(token64).toHaveLength(86)
		})

		test('should generate tokens of at least 32 characters for 32 bytes', () => {
			const token = generateSecureToken(32)

			// Ensure minimum secure length
			expect(token.length).toBeGreaterThanOrEqual(43)
		})
	})
})
