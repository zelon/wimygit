import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src-tauri/target']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      // tauri-plugin-dialog replaces window.confirm with an async function, so
      // `if (!confirm(...))` never blocks (a Promise is always truthy).
      'no-restricted-globals': ['error', {
        name: 'confirm',
        message: 'Use `await confirm()` from @tauri-apps/plugin-dialog; window.confirm is async in Tauri and never blocks.',
      }],
      'no-restricted-properties': ['error', {
        object: 'window',
        property: 'confirm',
        message: 'Use `await confirm()` from @tauri-apps/plugin-dialog; window.confirm is async in Tauri and never blocks.',
      }],
    },
  },
])
