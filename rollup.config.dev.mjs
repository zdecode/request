// @ts-check
import { defineConfig } from 'rollup'
import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import del from 'rollup-plugin-delete'
import { inlineTemplates } from './scripts/inline-templates.mjs'
/**
 *  @type {import('rollup').InputOptions['plugins']}
 */
const devPlugins = [
  del({
    targets: ['packages/core/dist/*', 'packages/coretemp/*'],
    force: true,
    hook: 'buildStart',
  }),
  typescript({
    tsconfig: './packages/core/tsconfig.json',
  }),
  nodeResolve(),
  commonjs(),
]

export default defineConfig([
  {
    input: {
      index: 'packages/core/src/index.ts',
      http: 'packages/core/src/http.ts',
      wx: 'packages/core/src/wx.ts',
      uni: 'packages/core/src/uni.ts',
      taro: 'packages/core/src/taro.ts',
    },
    output: [
      {
        format: 'commonjs',
        dir: 'packages/core/dist',
        entryFileNames: '[name].cjs.js',
        sourcemap: true,
      },
      {
        format: 'es',
        dir: 'packages/core/dist',
        entryFileNames: '[name].esm.js',
        sourcemap: true,
      },
    ],
    external: [
      'axios',
      'qs',
      '@tarojs/taro',
    ],
    plugins: devPlugins,
  },
  {
    input: 'packages/core/src/cli.ts',
    output: {
      file: 'packages/core/dist/cli.cjs.js',
      format: 'cjs',
      banner: '#!/usr/bin/env node',
    },
    external: [
      'fs',
      'path',
      'os',
      'process',
      'child_process',
      'url',
      'buffer',
      'stream',
      'util',
      /^node:/,
    ],
    plugins: [
      inlineTemplates(),
      typescript({
        tsconfig: './packages/core/tsconfig.json',
        declaration: false,
        noCheck: true,
      }),
      nodeResolve({ preferBuiltins: true }),
      commonjs(),
    ],
  },
])
