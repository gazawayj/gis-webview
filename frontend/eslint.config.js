const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const angularPlugin = require('@angular-eslint/eslint-plugin');
const angularTemplatePlugin = require('@angular-eslint/eslint-plugin-template');
const angularTemplateParser = require('@angular-eslint/template-parser');

const globals = {
  console: 'readonly',
  window: 'readonly',
  document: 'readonly',
  process: 'readonly',
  module: 'readonly',
  require: 'readonly'
};

module.exports = [
  // =========================
  // GLOBAL IGNORES
  // =========================
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'out-tsc/**',
      'eslint.config.js',
      '*.config.js'
    ]
  },

  js.configs.recommended,

  // =========================
  // TYPESCRIPT FILES (all src files including specs)
  // =========================
  {
    files: ['src/**/*.ts', 'src/**/*.js'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        tsconfigRootDir: __dirname,
        sourceType: 'module'
      },
      globals
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@angular-eslint': angularPlugin
    },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...angularPlugin.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-console': 'off',
      'no-undef': 'off'
    }
  },

  // =========================
  // ANGULAR HTML TEMPLATES
  // =========================
  {
    files: ['src/**/*.html'],
    languageOptions: {
      parser: angularTemplateParser
    },
    plugins: {
      '@angular-eslint/template': angularTemplatePlugin
    },
    rules: {
      ...angularTemplatePlugin.configs.recommended.rules
    }
  }
];
