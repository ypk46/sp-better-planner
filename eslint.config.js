// @ts-check
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'types/plugin-api'] },
  {
    files: ['**/*.ts'],
    extends: [...tseslint.configs.recommended, prettierRecommended],
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
);
