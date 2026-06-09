# 테스트 결과

- 일자: 2026-06-09
- 환경: macOS (Darwin 24.4.0) · Node v23.11.0 · Electron 32.3.3
- 실행: `npm --prefix app test` (lrc-core + i18n)

## 1. 순수 로직 단위 테스트 — `lrc-core`

실행:
```bash
node app/test/lrc-core.test.js
```

결과: **18 passed, 0 failed** ✅ (fmt/parseTimeStr/parse/round-trip/샘플)

| # | 케이스 | 결과 |
|---|--------|------|
| 1 | fmt: 0초 → `00:00.00` | ✓ |
| 2 | fmt: 76.5초 → `01:16.50` | ✓ |
| 3 | fmt: 반올림 경계(9.999) → `00:09.99` | ✓ |
| 4 | fmt: null → `--:--.--` | ✓ |
| 5 | parse: 단일 태그 | ✓ |
| 6 | parse: 밀리초 3자리(`[00:01.500]`→1.5s) | ✓ |
| 7 | parse: 한 줄 다중 태그(반복 가사) 분리 | ✓ |
| 8 | parse: id 태그(`[ti:]`) 무시 | ✓ |
| 9 | parse: 시간순 정렬 | ✓ |
| 10 | round-trip: parse→serialize→parse 값 보존 | ✓ |
| 11 | 실제 `sample/cherry.lrc` 파싱(20줄, 단조 증가, 직렬화 재파싱 줄수 동일) | ✓ |

## 2. 언어팩 단위 테스트 — `i18n`

실행:
```bash
node app/test/i18n.test.js
```

결과: **8 passed, 0 failed** ✅
- en/ko/ja/zh **키 집합 완전 일치**(누락/잉여 0), 빈 값 0
- 기본 en, `setLang` 전환, 알 수 없는 언어 무시, `{name}`/`{path}` 보간, 미존재 키 폴백

## 3. Electron 부팅 스모크 테스트

실행:
```bash
SMOKE=1 npm --prefix app start
```

동작: 앱 부팅 → 렌더러 로드 → `window.LRC` / `window.I18N` 검증 후 자동 종료.

출력:
```
[smoke] parsedLines=2 parseTimeStr=83.45 langs=4 ko.save=저장…
[smoke] OK
```

검증 항목:
- ✅ 메인/preload/렌더러 로드 시 예외 없음 (`render-process-gone` 미발생)
- ✅ `lrc-core.js` + `i18n.js` 로드 및 파싱/시간검증/언어전환 동작
- ✅ CSP·contextIsolation 설정 하에서 렌더러 정상 구동

## 수동 확인 권장 (GUI 상호작용 — 자동화 범위 밖)

다음은 실제 창에서 한 번 눈으로 확인 권장:
- [ ] mp3 재생/일시정지/시크/배속
- [ ] `S` 로 선택 줄 타임스탬프 찍힌 뒤 다음 줄 자동 이동
- [ ] 데모 모드에서 재생 위치 따라 가사 하이라이트 + 스크롤
- [ ] 드래그앤드롭으로 mp3/lrc 로드
- [ ] 저장 후 생성된 `.lrc` 재오픈 일치

## 종합

자동화 가능한 핵심 로직(파싱/직렬화/포맷)과 앱 부팅·IPC·샘플 연동 경로는 **전부 통과**.
GUI 상호작용은 위 체크리스트로 수동 확인.
