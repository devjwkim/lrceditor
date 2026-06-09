# LRC EDITOR

mp3를 재생하며 줄 단위 LRC 가사를 만들고 편집하는 **크로스플랫폼 데스크톱 앱** (Mac / Windows / Linux).
Electron 기반 GUI로, 좌측에서 음악을 재생하면서 우측에서 시간 동기화된 가사를 작성·수정합니다.

> 모든 애플리케이션 소스는 [`app/`](app/) 아래에 있습니다.

## 주요 기능

- 🎵 **재생기** — mp3 로드(버튼 / 드래그앤드롭), 재생·일시정지, 5초 탐색, 배속(0.5~1.5×), 시크바
- 📝 **LRC 편집기**
  - 가사 줄에 현재 재생 시각을 찍어 `[mm:ss.xx]` 타임스탬프 생성 (`S`)
  - 가사 영역 클릭으로 바로 텍스트 편집 (빈 줄 포함, 순수 텍스트만 입력)
  - 타임스탬프 더블클릭으로 시간 직접 편집 (형식 `mm:ss.xx` 검증, 수정 시 자동 재정렬)
  - 줄 추가/삭제, `새 LRC`로 빈 문서 시작, `LRC 열기/저장`
  - **데모 모드** — 재생 위치에 맞춰 현재 가사 줄 하이라이트
  - mp3 / LRC 각각 **해제**하고 다른 파일로 교체 가능
- LRC 형식: 줄 단위 표준 `[mm:ss.xx]` (단어 단위 Enhanced LRC는 후속 예정)

## 사용법

가사를 처음부터 만드는 기본 흐름입니다.

1. **음악 불러오기** — 좌측 패널에 mp3를 **끌어다 놓거나** `mp3 열기…` 버튼으로 선택
2. **가사 준비**
   - 새로 작성: `새 LRC` → 빈 줄이 생기면 **가사 영역을 클릭**해 한 줄씩 입력 (`Enter`로 확정, `+ 줄 추가`로 줄 늘리기)
   - 기존 파일 수정: `LRC 열기…` 로 `.lrc` 불러오기
3. **타이밍 찍기** — 음악을 재생(`▶︎` 또는 `Space`)하고, 가사가 시작되는 순간 그 줄을 선택한 뒤 `S`(또는 `⏱ 현재 시각 찍기`) → 선택 줄에 `[mm:ss.xx]`가 기록되고 자동으로 다음 줄로 이동
4. **미세 조정**
   - 시간 값을 **더블클릭**하면 직접 편집 (형식 `mm:ss.xx`, 틀리면 저장 안 됨). 시간을 바꿔 순서가 어긋나면 **자동 재정렬**
   - 시간을 **한 번 클릭**하면 그 시각으로 이동(미리듣기)
5. **데모 확인** — 우측 상단 `데모` 체크 → 재생 위치에 맞춰 현재 가사 줄이 하이라이트
6. **저장** — `저장…` → `.lrc` 파일로 저장 (mp3가 열려 있으면 기본 파일명이 `mp3이름.lrc`)

음악이나 가사를 바꾸려면 `mp3해제` / `LRC해제` 로 비운 뒤 다른 파일을 넣으면 됩니다.

### 단축키
| 키 | 동작 |
|----|------|
| `S` | 선택한 줄에 현재 재생 시각 찍기 |
| `Space` | 재생 / 일시정지 |
| `↑` `↓` | 가사 줄 선택 이동 |
| `Enter` | 텍스트·시간 편집 확정 |
| `Esc` | 편집 취소 |

## 설치 (배포본 실행)

[Releases](https://github.com/devjwkim/lrceditor/releases) 또는 빌드한 `app/dist/`에서 OS에 맞는 파일을 사용하세요.

| 플랫폼 | 파일 |
|--------|------|
| macOS (Apple Silicon) | `LRC EDITOR-x.y.z-arm64.dmg` |
| macOS (Intel) | `LRC EDITOR-x.y.z.dmg` |
| Windows | `LRC EDITOR Setup x.y.z.exe` |
| Ubuntu/Linux (실행형) | `LRC EDITOR-x.y.z.AppImage` |
| Ubuntu/Debian (패키지) | `lrc-editor_x.y.z_amd64.deb` |

> ⚠️ **코드 서명을 하지 않은 빌드**라, 처음 실행할 때 OS가 "확인되지 않은 개발자" 경고를 띄웁니다. 아래 방법으로 한 번만 허용하면 됩니다.
>
> - **macOS**: 앱을 **우클릭 → 열기 → (다시) 열기**. 또는 터미널에서 격리 속성 제거:
>   ```bash
>   xattr -dr com.apple.quarantine "/Applications/LRC EDITOR.app"
>   ```
> - **Windows**: SmartScreen 화면에서 **추가 정보 → 실행**.
> - **Linux (AppImage)**: 실행 권한을 준 뒤 실행:
>   ```bash
>   chmod +x "LRC EDITOR-x.y.z.AppImage" && ./"LRC EDITOR-x.y.z.AppImage"
>   ```
> - **Linux (deb)**: `sudo dpkg -i lrc-editor_x.y.z_amd64.deb`

## 개발

```bash
cd app
npm install              # 최초 1회 (의존성 설치)
npm start                # 앱 실행
npm test                 # 순수 LRC 로직 단위 테스트 (파싱/직렬화/시간검증)
SMOKE=1 npm start        # Electron 부팅 + LRC 로직 스모크 테스트
```

### 설치 파일 빌드 (electron-builder)

```bash
cd app
npm run dist:mac     # dmg + zip (arm64 + x64)
npm run dist:win     # nsis 설치기 (x64) — electron-builder 가 wine 자동 처리
npm run dist:linux   # AppImage + deb (x64)
npm run dist:all     # 셋 다
```

산출물은 `app/dist/` 에 생성됩니다(Git 추적 제외).

현재 상태: 단위 테스트 18종 통과, Electron 부팅 스모크 통과. 자세한 결과는 [`app/test/RESULTS.md`](app/test/RESULTS.md).

## 구조

```
.
├─ README.md            # (이 파일)
└─ app/                 # 애플리케이션 소스 전체
   ├─ main.js           # Electron 메인: 창 생성 + 파일 IPC(열기/저장)
   ├─ preload.js        # contextBridge 로 안전한 api 노출
   ├─ index.html        # 좌(재생기)/우(편집기) 2분할 레이아웃
   ├─ styles.css
   ├─ renderer.js       # UI 로직 (오디오 제어, 행 렌더, 타임스탬프, 데모)
   ├─ lrc-core.js       # 순수 LRC 로직(파싱/직렬화/시간포맷) — 브라우저·Node 공용
   └─ test/             # 헤드리스 테스트 + 결과
```

## 기술 스택

Electron 32 · Node.js · Vanilla JS/HTML/CSS
보안: `contextIsolation` on, `nodeIntegration` off, CSP 적용, 파일 접근은 메인 프로세스 IPC 경유.

## 라이선스

MIT
