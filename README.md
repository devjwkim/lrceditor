# LRC EDITOR

mp3를 재생하며 줄 단위 LRC 가사를 만들고 편집하는 **크로스플랫폼 데스크톱 앱** (Mac / Windows).
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

## 실행

```bash
cd app
npm install      # 최초 1회 (Electron 설치)
npm start        # 앱 실행
```

## 테스트

```bash
cd app
npm test                 # 순수 LRC 로직 단위 테스트 (파싱/직렬화/시간검증)
SMOKE=1 npm start        # Electron 부팅 + 샘플 로드 스모크 테스트
```

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
