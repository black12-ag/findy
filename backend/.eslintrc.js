module.exports = {
  parser: '@typescript-eslint/parser',
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'prettier', // Assuming prettier is used for formatting
  ],
  plugins: ['@typescript-eslint'],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
    project: './tsconfig.json', // Specify project for type-aware linting
  },
  env: {
    node: true,
    jest: true,
  },
  rules: {
    // Add any specific rules for your project here
    // Example: 'indent': ['error', 2],
    // '@typescript-eslint/explicit-module-boundary-types': 'off',
  },
};