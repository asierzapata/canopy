import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
	plugins: [tsconfigPaths()],
	test: {
		globalSetup: ['./src/testing/global-setup.ts'],
		environment: 'node',
		globals: true,
		include: ['**/*.spec.ts'],
		disableConsoleIntercept: true,
	},
})
