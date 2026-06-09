# Third-Party Notices

LRC EDITOR itself is licensed under the MIT License (see [LICENSE](LICENSE)).

It has **no runtime npm dependencies** of its own (the `dependencies` field is
empty). However, when distributed as a **packaged desktop application**
(`.dmg` / `.exe` / `.AppImage` / `.deb`), it bundles the Electron runtime, which
in turn embeds Chromium, Node.js, V8 and FFmpeg. Their licenses are reproduced
in full inside each distributed app under `Resources/licenses/`
(`Electron-LICENSE.txt` and `LICENSES.chromium.html`).

The lists below were derived from the actual build (Electron 32.3.3).

## Bundled in distributed binaries

| Component | License | Notes |
|-----------|---------|-------|
| [Electron](https://github.com/electron/electron) 32.3.3 | MIT | Copyright (c) Electron contributors; Copyright (c) 2013-2020 GitHub Inc. |
| [Chromium](https://www.chromium.org/) | BSD-3-Clause + many | ~2,600 third-party components; full texts in `LICENSES.chromium.html` |
| [Node.js](https://nodejs.org/) | MIT | Includes OpenSSL (Apache-2.0), libuv (MIT), zlib (Zlib), c-ares (MIT), llhttp (MIT), ngtcp2/nghttp2 (MIT), etc. |
| [V8](https://v8.dev/) | BSD-3-Clause | JavaScript engine |
| [FFmpeg](https://ffmpeg.org/) (`libffmpeg.dylib` / `ffmpeg.dll` / `libffmpeg.so`) | **LGPL-2.1-or-later** | Electron ships the LGPL build for audio/video decoding |

### FFmpeg / LGPL note
FFmpeg is distributed under the LGPL and is shipped as a **separate, dynamically
linked shared library** (`libffmpeg.dylib` on macOS, `ffmpeg.dll` on Windows,
`libffmpeg.so` on Linux). Per the LGPL, an end user may replace that library
with their own compatible build. No FFmpeg source is modified by this project.

## Build-time only (NOT distributed)

These are `devDependencies` used to run/package the app; they are not shipped
inside the installers.

| Component | License |
|-----------|---------|
| [electron](https://github.com/electron/electron) (^32.3.3) | MIT |
| [electron-builder](https://github.com/electron-userland/electron-builder) (^25.1.8) | MIT |
| electron-builder's dependency tree (app-builder-lib, builder-util, 7zip-bin, etc.) | Mostly MIT / BSD / ISC |
| Icon tooling: macOS `iconutil` (Apple, system), ImageMagick `magick` (ImageMagick License, Apache-2.0-style) | used only to generate icons |

## How to view full license texts

- In a built app: `…/LRC EDITOR.app/Contents/Resources/licenses/` (macOS) or the
  `resources/licenses/` folder next to the executable (Windows/Linux).
- From source: `app/node_modules/electron/dist/LICENSE` and
  `app/node_modules/electron/dist/LICENSES.chromium.html` after `npm install`.

If you believe an attribution is missing or incorrect, please open an issue at
<https://github.com/devjwkim/lrceditor/issues>.
