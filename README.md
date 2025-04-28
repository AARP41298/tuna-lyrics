# Tuna Lyrics (tuna-lyrics)

Lyrics display for Tuna.\
Inspired by https://github.com/univrsal/tuna \
99% of the code stolen from https://github.com/th-ch/youtube-music 

 


# Install
1. Download from [releases](https://github.com/AARP41298/tuna-lyrics/releases)
2. Unzip.
3. Mount in an http server.
    - [simple-http-server](https://github.com/TheWaWaR/simple-http-server)
      - Windows: `x86_64-pc-windows-msvc-simple-http-server.exe -i "C:\foo\bar\tuna-lyrics"`
      - URL: `http://localhost:8000/#/`
    - [Python](https://www.python.org/)
      - `py -m http.server --directory "C:\foo\bar\tuna-lyrics"`
      - URL: `http://localhost:8000/#/`
    - [Node](https://nodejs.org/es)
      - `npm install --global serve`
      - `serve "C:\foo\bar\tuna-lyrics"`
      - URL: `http://localhost:3000/#/`
4. Add a browser source in OBS using that URL.
![image](https://github.com/user-attachments/assets/3bc77384-032c-4bf2-86fd-c5392d5bb8a0)


# DEV
## Install the dependencies
```bash
yarn
# or
npm install
```

### Start the app in development mode (hot-code reloading, error reporting, etc.)
```bash
quasar dev
```


### Lint the files
```bash
yarn lint
# or
npm run lint
```


### Format the files
```bash
yarn format
# or
npm run format
```


### Build the app for production
```bash
quasar build
```

### Customize the configuration
See [Configuring quasar.config.js](https://v2.quasar.dev/quasar-cli-vite/quasar-config-js).
