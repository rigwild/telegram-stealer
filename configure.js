const fs = require('fs')
const path = require('path')

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

const runnerPath = path.join(__dirname, 'runner.js')

let runnerCode = fs.readFileSync(runnerPath, 'utf8')

const chatId = argv[0]
const token = argv[1]

runnerCode = runnerCode.replace(/telegramChatId: .*/g, `telegramChatId: '${chatId}',`)
runnerCode = runnerCode.replace(/telegramToken: .*/g, `telegramToken: '${token}',`)

fs.writeFileSync(runnerPath, runnerCode, 'utf8')

console.log('Chat ID and token replaced in runner.js')
