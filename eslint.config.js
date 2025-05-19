const reactRecommended = require('eslint-plugin-react/configs/recommended');
const reactHooks = require('eslint-plugin-react-hooks');
const typescriptParser = require('@typescript-eslint/parser');
const globals = require('globals');

const globalsBrowser = { ...globals.browser };

if (!('AudioWorkletGlobalScope' in globalsBrowser)) {
    // This particular key in the globals object has a trailing space, so for now we work around that problem here
    globalsBrowser['AudioWorkletGlobalScope'] = globalsBrowser['AudioWorkletGlobalScope '];
    delete globalsBrowser['AudioWorkletGlobalScope '];
}

module.exports = [
    {
        files: ['**/*.{js,mjs,cjs,jsx,mjsx,ts,tsx,mtsx}'],
        ...reactRecommended,
        rules: {
            ...reactRecommended.rules,
            ...reactHooks.configs.recommended.rules,
            'react/jsx-uses-react': 'off',
            'react/react-in-jsx-scope': 'off',
            'react/prop-types': 'off',
        },
        plugins: {
            ...reactRecommended.plugins,
            'react-hooks': { rules: { ...reactHooks.rules } },
        },
        settings: {
            ...reactRecommended.settings,
            react: {
                version: 'detect',
            },
        },
        languageOptions: {
            ...reactRecommended.languageOptions,
            ecmaVersion: 'latest',
            sourceType: 'module',
            parser: typescriptParser,
            parserOptions: {
                ecmaFeatures: {
                    jsx: true,
                },
            },
            globals: {
                ...globals.serviceworker,
                ...globalsBrowser,
            },
        },
    },
];
