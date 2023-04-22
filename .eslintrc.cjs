/**
 * @type {import('@typescript-eslint').ESLintOptions}
 */
module.exports = {
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    rules: {
        "@typescript-eslint/no-empty-function": 0,
        "@typescript-eslint/no-non-null-assertion": 0,
        "no-async-promise-executor": 0,
        "no-constant-condition": ["error", { "checkLoops": false }],
        "@typescript-eslint/no-unnecessary-condition": ["error", { "allowConstantLoopConditions": true }],
    },
    root: true,
    parserOptions: {
        project: true,
    }
};
