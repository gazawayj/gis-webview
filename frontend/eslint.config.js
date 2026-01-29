// @ts-check
const eslint = require("@eslint/js");
const { defineConfig } = require("eslint/config");
const tseslint = require("typescript-eslint");
const angular = require("angular-eslint");

module.exports = defineConfig([
  {
    ignores: [
      "**/tiles/**", 
      "node_modules/", 
      "dist/", 
      "README.md", 
      "**/README.md",
      ".eslintignore" 
  },
  {
    files: ["**/*.ts"],
    extends: [
      eslint.configs.recommended,
      tseslint.configs.recommended,
      tseslint.configs.stylistic,
      angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      // 1. Allow 'any' (common in tests/OpenLayers)
      "@typescript-eslint/no-explicit-any": "off",
      // 2. Allow unused vars (helps with WIP tests)
      "@typescript-eslint/no-unused-vars": "warn",
      // 3. Allow simple type annotations (e.g. name: string = 'Mars')
      "@typescript-eslint/no-inferrable-types": "off",
      // 4. Relax the inject() requirement (keep constructor injection)
      "@angular-eslint/prefer-inject": "off",
      // 5. Allow empty functions (needed for mocks)
      "@typescript-eslint/no-empty-function": "off",

      "@angular-eslint/directive-selector": [
        "error",
        {
          type: "attribute",
          prefix: "app",
          style: "camelCase",
        },
      ],
      "@angular-eslint/component-selector": [
        "error",
        {
          type: "element",
          prefix: "app",
          style: "kebab-case",
        },
      ],
    },
  },
  {
    files: ["**/*.html"],
    extends: [
      angular.configs.templateRecommended,
      angular.configs.templateAccessibility,
    ],
    rules: {
      "@angular-eslint/template/prefer-control-flow": "off"
    },
  }
]);
