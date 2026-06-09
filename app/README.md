# LRC EDITOR — app/

Cross-platform Electron GUI (Mac / Windows / Linux) for creating and editing
line-level LRC lyrics while playing an mp3.
(All source lives here under `app/`; the repo root holds only metadata.)

See the [root README](../README.md) for the full feature list and install guide.

## Run

```bash
cd app
npm install      # first time (installs electron)
npm start        # launch the app
```

## Layout (screens)

| Area | What it does |
|------|--------------|
| Left — Player | load mp3 (button / drag & drop), play・pause, ±5s seek, speed (0.5–1.5×), seek bar, time display |
| Right — LRC editor | line list, stamp time, add/delete lines, click-to-edit text, editable timestamps, open/save lrc, demo (follow lyrics) |

## Workflow (play + manual stamping)

1. Drag mp3・lrc onto the left, or use `Open mp3…` / `Open LRC…`
2. Play (`▶︎` or `Space`) and click a lyric line to select it
3. When the line starts, press `S` (or `⏱ Stamp time`) → `[mm:ss.xx]` is written to the line and selection advances
4. Tick `Demo` to highlight the current line as playback moves
5. `Save…` exports a `.lrc` (sorted by time)

### Shortcuts
- `S` stamp time on the selected line · `Space` play/pause · `↑/↓` move selection · `Enter` confirm · `Esc` cancel

## Language

UI language pack in `i18n.js`: **English (default)**, 한국어, 日本語, 中文.
Switch from the top-right selector; the choice is saved (localStorage).

## LRC format
- Supported: standard line-level `[mm:ss.xx] text` (3-digit ms `[mm:ss.xxx]` is also parsed)
- Multiple time tags on one line (repeated lyrics) are split into separate lines
- ID tags like `[ti:]` are excluded from editing
- Word-level Enhanced LRC (`<mm:ss.xx>`) is a later milestone

## Structure

```
app/
├─ main.js        # Electron main: window + file IPC (open/save)
├─ preload.js     # safe api via contextBridge (webUtils.getPathForFile)
├─ index.html     # split layout: player (left) / editor (right)
├─ styles.css
├─ renderer.js    # UI logic (audio, rows, stamping, demo, i18n)
├─ lrc-core.js    # pure LRC logic (parse/serialize/time) — browser & Node
├─ i18n.js        # language pack (en/ko/ja/zh) — browser & Node
├─ build/         # app icons (icns/ico/png)
└─ test/          # headless tests + results (RESULTS.md)
```

Security: `contextIsolation` on, `nodeIntegration` off, CSP applied, file access via the main process over IPC.

## Tests

```bash
npm --prefix app test           # unit tests (lrc-core + i18n)
SMOKE=1 npm --prefix app start  # Electron boot smoke test
```

See [`test/RESULTS.md`](test/RESULTS.md) for results.
