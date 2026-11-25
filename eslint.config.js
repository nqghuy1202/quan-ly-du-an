import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'src/astryx-themes.ts', 'src/themes', 'themes'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended, reactHooks.configs.flat.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    // Giao diện: không `div`/`span` thô, không style nội tuyến (luật Astryx; xem AGENTS.md).
    files: ['src/**/*.tsx'],
    ignores: ['src/**/*.test.tsx'],
    rules: {
      'no-restricted-syntax': [
        'error',
        { selector: "JSXOpeningElement[name.name=/^(div|span)$/]", message: 'Dùng component Astryx, không dùng div/span thô.' },
        { selector: "JSXAttribute[name.name='style']", message: 'Dùng prop của component, xstyle hoặc token, không dùng style nội tuyến.' },
        { selector: "JSXAttribute[name.name='className']", message: 'Dùng prop của component, xstyle hoặc token, không dùng className.' },
      ],
    },
  },
  {
    files: ['*.config.{js,ts}', 'vite.config.ts'],
    languageOptions: { globals: globals.node },
  },
)
