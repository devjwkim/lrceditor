#!/usr/bin/env bash
# macOS 정식 서명(Developer ID) + 공증(App Store Connect API Key) 빌드.
#   사용법:  cd app && bash release-mac.sh
#   전제:    app/.env 에 APPLE_API_KEY(.p8 경로)/APPLE_API_KEY_ID/APPLE_API_ISSUER/APPLE_TEAM_ID
#            + 키체인에 "Developer ID Application: … (N7LGK98BF6)" 인증서.
# 공증은 Apple 서버 업로드/대기로 수 분 소요됩니다.
set -euo pipefail
cd "$(dirname "$0")"

if [[ ! -f .env ]]; then echo "❌ app/.env 가 없습니다 (서명/공증 자격증명)." >&2; exit 1; fi
set -a; source ./.env; set +a

# 정식 서명 경로: CSC 자동탐색 ON(=ad-hoc 재서명 건너뜀). electron-builder 가 키체인의
# Developer ID 를 자동 선택해 서명 후 notarytool 로 공증한다.
unset CSC_IDENTITY_AUTO_DISCOVERY || true
echo "▶ Developer ID 서명 + 공증 빌드 시작 (팀 ${APPLE_TEAM_ID:-?})"
npx electron-builder --mac

echo "▶ 서명/공증 검증"
APP="dist/mac-arm64/LRC EDITOR.app"
[ -d "$APP" ] || APP="dist/mac/LRC EDITOR.app"
codesign --verify --deep --strict --verbose=2 "$APP" 2>&1 | tail -2 || true
echo "--- Gatekeeper(spctl) ---"; spctl -a -vv "$APP" 2>&1 | head -3 || true
echo "--- 공증 스테이플 확인 ---"; xcrun stapler validate "$APP" 2>&1 | tail -2 || true
