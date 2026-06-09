# LRC EDITOR

A cross-platform **desktop app** (Mac / Windows / Linux) for creating and editing
line-level LRC lyrics while playing an mp3. Built with Electron: play the music on the
left, write time-synced lyrics on the right.

> All application source lives under [`app/`](app/).

## Features

- 🎵 **Player** — load mp3 (button / drag & drop), play・pause, ±5s seek, speed (0.5–1.5×), seek bar
- 📝 **LRC editor**
  - Stamp the current playback time onto a line as `[mm:ss.xx]` (`S`)
  - Click a lyric area to edit text inline (empty lines included, plain text only)
  - Double-click a timestamp to edit the time directly (validated `mm:ss.xx`, auto re-sort on change)
  - Add / delete lines, start a blank doc with `New LRC`, `Open` / `Save` LRC
  - **Demo mode** — highlight the current lyric line as playback moves
  - Independently **clear** mp3 / LRC and swap in different files
- 🎤 **Demo play** — full-screen karaoke view showing previous / current / next lyric
  (prev & next dimmed), with a playback bar, play・seek, and **A–B section loop**
- 🌐 **Language pack** — UI in **English (default)**, **한국어**, **日本語**, **中文**; switch from the top-right selector (choice is remembered)
- LRC format: standard line-level `[mm:ss.xx]` (word-level Enhanced LRC is planned)

## How to use

Basic flow for writing lyrics from scratch:

1. **Load audio** — drag an mp3 onto the left panel, or use `Open mp3…`
2. **Prepare lyrics**
   - New: `New LRC` → a blank line appears → **click the lyric area** and type (`Enter` to confirm, `+ Add line` for more)
   - Existing: `Open LRC…` to load a `.lrc`
3. **Stamp timing** — play (`▶︎` or `Space`); when a line starts, select it and press `S` (or `⏱ Stamp time`). The time `[mm:ss.xx]` is recorded and selection moves to the next line.
4. **Fine-tune**
   - **Double-click** a time value to edit it (format `mm:ss.xx`; invalid input is rejected). Changing a time **re-sorts** the lines automatically.
   - **Single-click** a time to seek there (preview).
5. **Check with demo** — tick `Demo` (top-right of editor) to highlight the current line during playback.
6. **Save** — `Save…` writes a `.lrc` file (if an mp3 is loaded, the default filename is `<mp3 name>.lrc`).

Use `Clear mp3` / `Clear LRC` to empty a side and load different files.

### Language

Pick a language from the selector in the top bar (**English / 한국어 / 日本語 / 中文**).
The selection is saved and restored on next launch. Default is English.

### Shortcuts
| Key | Action |
|-----|--------|
| `S` | Stamp current playback time onto the selected line |
| `Space` | Play / pause |
| `↑` `↓` | Move line selection |
| `Enter` | Confirm text / time edit |
| `Esc` | Cancel edit |

## Install (prebuilt)

Grab the file for your OS from [Releases](https://github.com/devjwkim/lrceditor/releases) or your local `app/dist/`.

| Platform | File |
|----------|------|
| macOS (Apple Silicon) | `LRC EDITOR-x.y.z-arm64.dmg` |
| macOS (Intel) | `LRC EDITOR-x.y.z.dmg` |
| Windows | `LRC EDITOR Setup x.y.z.exe` |
| Ubuntu/Linux (portable) | `LRC EDITOR-x.y.z.AppImage` |
| Ubuntu/Debian (package) | `lrc-editor_x.y.z_amd64.deb` |

> ⚠️ These builds are **not code-signed**, so the OS shows an "unidentified developer" warning on first launch. Allow it once:
>
> - **macOS**: **right-click → Open → Open**, or remove the quarantine flag:
>   ```bash
>   xattr -dr com.apple.quarantine "/Applications/LRC EDITOR.app"
>   ```
> - **Windows**: on the SmartScreen prompt, **More info → Run anyway**.
> - **Linux (AppImage)**: make it executable and run:
>   ```bash
>   chmod +x "LRC EDITOR-x.y.z.AppImage" && ./"LRC EDITOR-x.y.z.AppImage"
>   ```
> - **Linux (deb)**: `sudo dpkg -i lrc-editor_x.y.z_amd64.deb`

## Development

```bash
cd app
npm install              # first time (install dependencies)
npm start                # run the app
npm test                 # unit tests (LRC core + language pack)
SMOKE=1 npm start        # Electron boot + logic smoke test
```

### Build installers (electron-builder)

```bash
cd app
npm run dist:mac     # dmg + zip (arm64 + x64)
npm run dist:win     # nsis installer (x64) — electron-builder handles wine
npm run dist:linux   # AppImage + deb (x64)
npm run dist:all     # all three
```

Artifacts are written to `app/dist/` (git-ignored).

Current status: 26 unit tests passing (18 LRC core + 8 language pack), Electron boot smoke passing.
Details in [`app/test/RESULTS.md`](app/test/RESULTS.md).

## Layout

```
.
├─ README.md            # (this file)
└─ app/                 # all application source
   ├─ main.js           # Electron main: window + file IPC (open/save)
   ├─ preload.js        # safe api via contextBridge
   ├─ index.html        # split layout: player (left) / editor (right)
   ├─ styles.css
   ├─ renderer.js       # UI logic (audio, rows, stamping, demo, i18n)
   ├─ lrc-core.js       # pure LRC logic (parse/serialize/time) — browser & Node
   ├─ i18n.js           # language pack (en/ko/ja/zh) — browser & Node
   ├─ build/            # app icons (icns/ico/png)
   └─ test/             # headless tests + results
```

## Tech stack

Electron 32 · Node.js · Vanilla JS/HTML/CSS.
Security: `contextIsolation` on, `nodeIntegration` off, CSP applied, file access via the main process over IPC.

## License

This project's own code is licensed under the **MIT License** — see [LICENSE](LICENSE).

Distributed binaries bundle the Electron runtime (Chromium, Node.js, V8, FFmpeg).
Those components keep their own licenses (MIT, BSD-3-Clause, Apache-2.0, LGPL-2.1
for FFmpeg, and many more). Full attributions are in
[THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md), and the complete license texts
are shipped inside each app under `Resources/licenses/`.
