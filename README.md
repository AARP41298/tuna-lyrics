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
![image](https://github.com/user-attachments/assets/a0e57ba9-51ba-440a-9a66-ffb6c7667ff4)


# Params
You can personalize how the lyrics are visualized.
| Param | Description   | Default     | Default example | Use example |
| ----- | -------- | ----------- | ------ | ------ |
| defaultText | The text to visualize if theres an empty line  |   ♪    | ![image](https://github.com/user-attachments/assets/483d8dbc-366a-4b58-a2d7-7d1c7a4ff56e) | defaultText=🎵 ![image](https://github.com/user-attachments/assets/0e66dce0-7faf-4b8e-ab50-8578b9d9fcb9) |
|   smallKanji  | Makes kanji smaller | false | ![image](https://github.com/user-attachments/assets/9d054791-6488-4e2f-8666-8f93ce7fc800) | smallKanji=true ![image](https://github.com/user-attachments/assets/865eaf0b-91b8-41a5-ade4-e4cb2590758c) |
## How to use?
Write them in the url like this: http://localhost:9000/#/?defaultText=🎵&smallKanji=true 

NOTE: Refresh cache every time you change params or updating version.\
![image](https://github.com/user-attachments/assets/a0ae6239-2a2b-4e9b-9ad2-f273fb07dc50)



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
