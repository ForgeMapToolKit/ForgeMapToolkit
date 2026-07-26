'use strict';
/**
 * eslint.config.js — flat config (ESLint 9).
 *
 * Two runtime worlds in this repo, linted with different rules:
 *   - src/**   — Vite/React renderer bundle. ESM + JSX, browser globals,
 *                react-hooks rules (the whole point of introducing lint —
 *                catches conditional-hook / stale-dependency bugs that
 *                otherwise only surface at runtime).
 *   - electron/**, utils/** — Electron main process. CommonJS, Node globals.
 *
 * Root-level tool configs (vite.config.js, postcss.config.js,
 * tailwind.config.js) are linted with whichever module system they actually
 * use — do NOT assume CommonJS just because package.json has no "type"
 * field; postcss.config.js and vite.config.js are ESM (`export default`).
 */

const js           = require('@eslint/js');
const globals      = require('globals');
const react        = require('eslint-plugin-react');
const reactHooks   = require('eslint-plugin-react-hooks');
const reactRefresh = require('eslint-plugin-react-refresh');

module.exports = [
  {
    // _backup/** holds inert reference copies of code removed from src/ (see
    // _backup/README.md). Nothing imports it and no config block below claims
    // it, so linting it would only produce parse errors on unclaimed JSX.
    ignores: ['dist/**', 'build/**', 'data/**', 'public/**', 'node_modules/**', '_backup/**'],
  },

  js.configs.recommended,

  // ── Renderer — src/** (ESM, JSX, browser) ─────────────────────────────────
  {
    files: ['src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // `process` is not injected into the context-isolated renderer, but a
      // few files (Settings.jsx) defensively feature-test it with
      // `typeof process !== 'undefined'` before touching it — declare it so
      // that guard doesn't read as a no-undef error.
      globals: { ...globals.browser, process: 'readonly' },
    },
    plugins: {
      react: react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Core `no-unused-vars` does not understand JSX: `<TabLayout />` does not
      // count as a use, so every imported component is reported as dead. That
      // turns the warning list into a trap during cleanup — it invites deleting
      // imports that are load-bearing. This rule marks JSX-referenced bindings
      // as used and is the only reason the plugin is here.
      'react/jsx-uses-vars': 'error',
      // `react/jsx-uses-react` is deliberately NOT enabled. The build uses the
      // automatic JSX runtime (@vitejs/plugin-react default), so a bare
      // `import React from 'react'` genuinely is dead and should be reported.
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // ── Electron main process + Node-side utils (CommonJS, require()d) ───────
  {
    files: [
      'electron/**/*.js',
      'utils/scmap.js',
      'utils/autosave-runner.js',
      'utils/generate-csp-hashes.js',
      'utils/generate-terraintypes.js',
      'eslint.config.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
    },
  },

  // ── Shared utils consumed only from the Vite renderer bundle (ESM) ────────
  // Despite living under top-level utils/, these are imported by src/**/*.jsx
  // (Wreckage.jsx, History.jsx, CliTerminal.jsx, etc.), never require()'d from
  // electron/ — so they're ESM, not CommonJS like their utils/ siblings above.
  {
    files: [
      'utils/CliSessionStore.js',
      'utils/ScmapHistoryTracker.js',
      'utils/readmeGenerator.js',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // ── Build/analysis scripts — Node ESM ─────────────────────────────────────
  // scripts/*.mjs run under plain node with `import`, outside both the renderer
  // bundle and the Electron main process. Without their own block they fall
  // through to js.configs.recommended with no globals declared, which reports
  // `console` and `process` as undefined.
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    },
  },

  // ── Root-level tool configs — ESM ─────────────────────────────────────────
  {
    files: ['vite.config.js', 'postcss.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.node },
    },
  },

  // ── Root-level tool configs — CommonJS ────────────────────────────────────
  {
    files: ['tailwind.config.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { ...globals.node },
    },
  },
];
