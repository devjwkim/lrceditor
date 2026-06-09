# LRC EDITOR — app/

mp3를 재생하며 줄 단위 LRC 가사를 만들고 편집하는 크로스플랫폼 Electron GUI (Mac/Windows).
(모든 소스는 이 `app/` 아래에 둔다 — 루트엔 메타만)

## 실행

```bash
cd app
npm install      # 최초 1회 (electron 설치)
npm start        # 앱 실행
```

## 화면 구성

| 영역 | 기능 |
|------|------|
| 좌측 — 재생기 | mp3 로드(버튼/드래그앤드롭), 재생·일시정지, 5초 탐색, 배속(0.5~1.5×), 시크바, 시간표시 |
| 우측 — LRC 편집기 | 가사 줄 목록, 타임스탬프 찍기, 줄 추가/삭제, 더블클릭 텍스트 편집, lrc 열기/저장, 데모(가사 따라가기) |

## 사용 흐름 (MVP: 재생 + 수동 타임스탬프)

1. mp3·lrc를 좌측에 끌어다 놓거나 `mp3 열기…` / `LRC 열기…`로 불러오기
2. 재생(▶︎ 또는 `Space`) 하면서 가사 줄을 클릭해 선택
3. 가사가 시작되는 순간 `S`(또는 `⏱ 현재 시각 찍기`) → 선택 줄에 `[mm:ss.xx]` 기록 후 다음 줄로 자동 이동
4. `데모` 체크 시 재생 위치에 맞춰 현재 가사 줄 하이라이트
5. `저장…` 으로 `.lrc` 출력 (시간순 정렬)

### 단축키
- `S` 현재 시각을 선택 줄에 찍기  ·  `Space` 재생/일시정지  ·  `↑/↓` 줄 선택 이동

## LRC 형식
- 지원: 줄 단위 표준 `[mm:ss.xx] 텍스트` (밀리초 3자리 `[mm:ss.xxx]` 입력도 파싱)
- 한 줄 다중 시간태그(반복 가사)는 각각의 줄로 분리
- `[ti:]` 등 id 태그는 편집 대상에서 제외
- 단어 단위 Enhanced LRC(`<mm:ss.xx>`)는 후속 마일스톤

## 구조

```
app/
├─ main.js        # Electron 메인: 창 생성 + 파일 IPC(열기/저장/샘플)
├─ preload.js     # contextBridge 로 안전한 api 노출 (webUtils.getPathForFile)
├─ index.html     # 좌(재생기)/우(편집기) 2분할 레이아웃
├─ styles.css
├─ renderer.js    # UI 로직 (오디오 제어, 행 렌더, 타임스탬프, 데모)
├─ lrc-core.js    # 순수 LRC 로직(파싱/직렬화/시간포맷) — 브라우저·Node 공용
└─ test/          # 헤드리스 테스트 + 결과 (RESULTS.md)
```

보안: `contextIsolation` on, `nodeIntegration` off, CSP 적용, 파일 접근은 메인 프로세스 IPC 경유.

## 테스트

```bash
node app/test/lrc-core.test.js      # 순수 로직 단위 테스트
SMOKE=1 npm --prefix app start      # Electron 부팅 스모크 테스트
```

결과는 [`test/RESULTS.md`](test/RESULTS.md) 참고.
