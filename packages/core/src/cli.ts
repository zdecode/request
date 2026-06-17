import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import * as p from '@clack/prompts'
// eslint-disable-next-line ts/ban-ts-comment
// @ts-ignore 由 rollup inline-templates 插件注入的虚拟模块
import { templates } from 'virtual:request-templates'

type Framework = 'web' | 'uni-app' | 'taro' | 'wx'
type TemplateKey = 'shared' | 'http' | 'uni' | 'taro' | 'wx'

const SOURCE_TEMPLATES = templates as Record<TemplateKey, string>

const FRAMEWORK_META: Record<Framework, { file: TemplateKey, className: string }> = {
  'web': { file: 'http', className: 'HttpRequest' },
  'uni-app': { file: 'uni', className: 'UniRequest' },
  'taro': { file: 'taro', className: 'TaroRequest' },
  'wx': { file: 'wx', className: 'WxRequest' },
}

function indexTs(className: string, file: string) {
  return `import { ${className} } from './core/${file}'

export const request = new ${className}({
  baseURL: '',
})
`
}

function writeFileSafe(filePath: string, content: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, content, 'utf-8')
}

async function main() {
  p.intro('@zdecode/request 初始化')

  // 步骤 1: 选择框架
  const framework = await p.select({
    message: '请选择框架',
    options: [
      { value: 'web', label: 'web', hint: 'axios + qs' },
      { value: 'uni-app', label: 'uni-app' },
      { value: 'taro', label: 'taro' },
      { value: 'wx', label: 'wx (微信小程序)' },
    ],
  })

  if (p.isCancel(framework)) {
    p.cancel('操作已取消')
    process.exit(0)
  }

  const fw = framework as Framework
  const { file, className } = FRAMEWORK_META[fw]
  const cwd = process.cwd()

  // 步骤 2: 修改 package.json（仅改 json，不安装）
  const pkgPath = path.join(cwd, 'package.json')
  if (fs.existsSync(pkgPath)) {
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    if (!pkg.dependencies)
      pkg.dependencies = {}
    if (!pkg.devDependencies)
      pkg.devDependencies = {}

    pkg.dependencies['lodash.merge'] = '^4.6.2'
    pkg.devDependencies['@types/lodash.merge'] = '^4.6.9'

    if (fw === 'web') {
      pkg.dependencies.axios = '^1.7.7'
      pkg.dependencies.qs = '^6.13.0'
      pkg.devDependencies['@types/qs'] = '^6.9.15'
    }

    fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf-8')
    p.log.success('已更新 package.json')
  }
  else {
    p.log.warn('未找到 package.json，跳过依赖写入')
  }

  // 步骤 3: 复制源文件
  const srcDir = path.join(cwd, 'src')
  const hasSrc = fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()
  const baseDir = hasSrc ? srcDir : cwd

  const requestRoot = path.join(baseDir, 'utils', 'request')
  const coreDir = path.join(requestRoot, 'core')

  // core/shared.ts + core/{框架}.ts 直接复制库源码
  writeFileSafe(path.join(coreDir, 'shared.ts'), SOURCE_TEMPLATES.shared)
  writeFileSafe(path.join(coreDir, `${file}.ts`), SOURCE_TEMPLATES[file])
  // index.ts 实例化对应框架的 Request
  writeFileSafe(path.join(requestRoot, 'index.ts'), indexTs(className, file))

  p.log.success(`已生成 ${path.relative(cwd, requestRoot).replace(/\\/g, '/')}/ 下的文件`)

  // 步骤 4: 提示安装依赖
  const deps = fw === 'web' ? 'lodash.merge axios qs' : 'lodash.merge'
  const devDeps = fw === 'web' ? '@types/lodash.merge @types/qs' : '@types/lodash.merge'

  p.note(
    `npm install ${deps}\nnpm install -D ${devDeps}\n\n# 或 pnpm:\npnpm add ${deps}\npnpm add -D ${devDeps}`,
    '请安装依赖',
  )

  // 步骤 5: 结束
  p.outro('初始化完成！')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
