# Tuna Lyrics (tuna-lyrics) Video Generator

Lyrics Video Generator.\
Inspired by https://github.com/univrsal/tuna \
99% of the code stolen from https://github.com/th-ch/youtube-music  \
Ported to be used with https://github.com/dtinth/html5-animation-video-renderer 

 


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
4. Clone [html5-animation-video-renderer](https://github.com/AARP41298/html5-animation-video-renderer/tree/cgptfix). NOTE: Need more test.

| Param       | Description                                                               | Default | Default example                                                                           | Use example                                                                                                    |
|-------------|---------------------------------------------------------------------------|---------|-------------------------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------|
| defaultText | The text to visualize if theres an empty line                             | ♪       | ![image](https://github.com/user-attachments/assets/483d8dbc-366a-4b58-a2d7-7d1c7a4ff56e) | defaultText=🎵<br> ![image](https://github.com/user-attachments/assets/0e66dce0-7faf-4b8e-ab50-8578b9d9fcb9)   |
| smallKanji  | Makes kanji smaller                                                       | false   | ![image](https://github.com/user-attachments/assets/9d054791-6488-4e2f-8666-8f93ce7fc800) | smallKanji=true <br> ![image](https://github.com/user-attachments/assets/865eaf0b-91b8-41a5-ade4-e4cb2590758c) |
| lrclibid    | Force to show the lyrics of the provided ID                               |         |                                                                                           | lrclibid=4799266                                                                                               |
| json        | Force to show the lyrics of the provided JSON. <br> Place in `public/lrc` |         |                                                                                           | json=cuando_te_vas                                                                                             |
| fps         | Framerate target of the generated video                                   | 24      |                                                                                           | fps=60                                                                                                         |
| height      | Height target of the generated video                                      | 1080    |                                                                                           | height=1440                                                                                                    |
| width       | Width target of the generated video                                       | 1920    |                                                                                           | width=2160                                                                                                     |
| debugTime   | In browser: Visualize the desired timestamp of the lyrics.                |         |                                                                                           |                                                                                                                |

## How to use?
Follow the instructions of [html5-animation-video-renderer](https://github.com/AARP41298/html5-animation-video-renderer/tree/cgptfix)

### Examples
```
node render --url="http://localhost:9000/#/?lrclibid=3362532" --video=exports/girlfriend.mov --alpha --parallelism=1
node render --url="http://localhost:9000/#/?lrclibid=4799266" --video=exports/makelove.mov --alpha --parallelism=1
node render --url="http://localhost:9000/#/?lrclibid=1877161&smallKanji=true" --video=exports/fantastic.mov --alpha --parallelism=1
node render --url="http://localhost:9000/#/?json=fantastic&smallKanji=true" --video=exports/fantastic_json.mov --alpha --parallelism=1
node render --url="http://localhost:9000/#/?lrclibid=4508180&smallKanji=true" --video=exports/baby_baby0.mov --alpha --parallelism=1 --end=1200
node render --url="http://localhost:9000/#/?lrclibid=4508180&smallKanji=true" --video=exports/baby_baby_p15.mov --parallelism=15 --alpha
node render --url="http://localhost:9000/#/?lrclibid=4508180&smallKanji=true&height=1200&fps=30" --video=exports/baby_baby_final.mov --parallelism=15 --alpha
node render --url="http://localhost:9000/#/?lrclibid=23315439&smallKanji=true&height=2160&width=3840&fps=60" --video=exports/girlfriend_final.mov --parallelism=15 --alpha --end=3000
node render --url="http://localhost:9000/#/?json=cuando_te_vas&smallKanji=true&fps=50" --video=exports/cuando_te_vas.mov --parallelism=12 --alpha
node render --url="http://localhost:9000/#/?lrclibid=3362532&width=3840&height=2160&smallKanji=true&fps=60" --video=exports/girlfriend.mov --alpha --parallelism=15
```
#### Final videos.
https://www.youtube.com/playlist?list=PLhuzr6DPRZXnk2Rxci9Apl-iPnH006aO0

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
