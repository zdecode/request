// @ts-check
import fs from 'node:fs'
import path from 'node:path'

const VIRTUAL_ID = 'virtual:request-templates'
const RESOLVED_ID = `\0${VIRTUAL_ID}`

// 需要复制到用户项目的源文件（不含扩展名）
const TEMPLATE_FILES = ['shared', 'http', 'uni', 'taro', 'wx']

/**
 * Rollup 插件：把请求库源文件内联为虚拟模块，
 * 供 CLI 在运行时把源码复制到用户项目。
 * @returns {import('rollup').Plugin}
 */
export function inlineTemplates() {
  const srcDir = path.resolve('packages/core/src')
  return {
    name: 'inline-templates',
    resolveId(id) {
      if (id === VIRTUAL_ID)
        return RESOLVED_ID
      return null
    },
    load(id) {
      if (id !== RESOLVED_ID)
        return null
      /** @type {Record<string, string>} */
      const templates = {}
      for (const name of TEMPLATE_FILES) {
        templates[name] = fs.readFileSync(path.join(srcDir, `${name}.ts`), 'utf-8')
      }
      return `export const templates = ${JSON.stringify(templates)}`
    },
  }
}
