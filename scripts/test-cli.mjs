// @ts-check
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { exec } from './exec.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')
const cliTestDir = path.resolve(projectRoot, 'cli-test')
const cliBin = path.resolve(projectRoot, 'packages', 'core', 'dist', 'cli.cjs.js')

// Step 1: 创建测试目录（先清空）
if (fs.existsSync(cliTestDir)) {
  fs.rmSync(cliTestDir, { recursive: true, force: true })
}
fs.mkdirSync(cliTestDir)
console.log('✓ 已创建 cli-test 目录')

// Step 2: npm init -y
const { ok: initOk, stderr: initErr } = await exec('npm', ['init', '-y'], { cwd: cliTestDir })
if (!initOk) {
  console.error('npm init 失败:', initErr)
  process.exit(1)
}
console.log('✓ 已初始化 package.json')

// Step 3: 写入最小化 tsconfig.json
fs.writeFileSync(
  path.join(cliTestDir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        skipLibCheck: true,
        types: [
          'miniprogram-api-typings',
          '@dcloudio/types',
        ],
      },
      include: ['src'],
    },
    null,
    2,
  ),
  'utf-8',
)
console.log('✓ 已写入 tsconfig.json')

// Step 4: 清空并重建 src 目录
const srcDir = path.join(cliTestDir, 'src')
if (fs.existsSync(srcDir)) {
  fs.rmSync(srcDir, { recursive: true, force: true })
}
fs.mkdirSync(srcDir)
console.log('✓ 已准备 src 目录')

// Step 5: 运行 CLI（交互式，stdio: inherit）
console.log('\n正在启动 CLI...\n')

const child = spawn('node', [cliBin], {
  cwd: cliTestDir,
  stdio: 'inherit',
  shell: process.platform === 'win32',
})

child.on('error', (err) => {
  console.error('CLI 启动失败:', err.message)
  process.exit(1)
})

child.on('close', (code) => {
  if (code === 0) {
    console.log('\n✓ CLI 执行完成')
  }
  else {
    console.error(`\nCLI 以状态码 ${code} 退出`)
    process.exit(code ?? 1)
  }
})
