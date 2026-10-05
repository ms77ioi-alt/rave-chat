# RAVE Chart · ULTIMATE

전체 교체용 최종 패키지입니다.

## 이번 버전
- 국내 종목: 한글 회사명 검색 → 네이버 금융 자동완성 사용
- 국내 종목: 6자리 종목코드 검색 지원
- 미국/해외: 영문 회사명/티커/ETF → Yahoo Finance 검색
- 미국 주요 종목의 한글 별칭 일부 지원
- 1달 차트 최소 데이터 조건 수정 (30 → 15)
- MA5/20/60/120, 거래량, RSI, MACD, 볼린저밴드 유지
- RAVE 점수, 관심구간, 추격주의, 추세이탈선, 자동 분석 유지
- 서비스워커 캐시 버전 갱신: 새 배포가 이전 화면에 묻히는 문제 완화
- index.html은 Netlify에서 no-cache 처리

## GitHub 업로드 구조
index.html
manifest.json
sw.js
netlify.toml
README.md
netlify/functions/search.js
netlify/functions/chart.js

기존 rave-chat 저장소의 같은 이름 파일을 이 패키지 파일로 교체한 뒤 Commit changes 하면 됩니다.

※ 네이버/Yahoo의 비공식 공개 엔드포인트를 사용하므로 제공처 정책 변경 시 추후 수정이 필요할 수 있습니다.
