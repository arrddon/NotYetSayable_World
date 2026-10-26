# Web V2 archive — 2026-10-26

현재 Latent Homes 지도 웹의 데이터·표현·인터랙션을 Web V2 기준으로 보관한다. V05는 전체 전시 작업공간의 이름이고, Web V2는 이 지도 웹의 보관 이름이다.

## 보관 기준

- 저장소: `arrddon/NotYetSayable_World`, 브랜치: `main`.
- Git 태그: `web-v2-20261026`.
- 공개 데이터: 완료 기록 210건, `synthetic: false`.
- 활성 버전: `live-927218f3621268c919dd8a36`.
- 파일: `dist/data/manifest.json`, `dist/data/archive.live-927218f3621268c919dd8a36.json`.
- 2026-10-26 기존 읽기 전용 발행기로 완료 목록을 재조회했다. 현재 210건과 동일하여 개별 원본을 추가 조회하지 않았다. 마지막 온라인 반영 기록 205건보다 5건 많다.
- 공개 데이터 파일은 406,755 byte이며 원문·번역 전문·손글씨 이미지·자격증명을 포함하지 않는다.
- 기존 지도·키워드·군집·GPU 그래픽·iPad control/display 로직을 유지한다. 이번 변경은 데이터와 문서 발행이다.
- `npm run check`: 34개 통과. 브라우저 시각 확인과 TD 실기는 이번 발행에서 다시 실행하지 않았다.

## 복원과 다음 버전

실행 중인 전시와 기존 안내가 사용하는 `latent-homes-web/` 폴더명은 유지한다. Git 태그가 가리키는 커밋에 웹 소스와 공개 데이터가 함께 고정된다.

현재 체크아웃에서 해당 태그의 소스를 ZIP으로 보관하는 명령:

```sh
git archive --format=zip --prefix=latent-homes-web-v2/ --output=.openai/local/archives/latent-homes-web-v2-20261026.zip web-v2-20261026
```

ZIP은 Git에 추적되는 파일만 포함한다. `.env.local`, 원본 아카이브, 개인 실행 설정, Git 인증 정보는 포함하지 않는다. `.openai/local/archives/`는 로컬 보관용이며 Git·정적 배포 대상에서 제외된다.

태그의 소스만 새 폴더에 복원하려면 위 ZIP을 해제한다. Git 이력까지 필요하면 저장소를 별도로 clone하고 `git switch --detach web-v2-20261026`을 사용한다.

같은 데이터·집계 로직을 사용하는 새 비주얼·인터랙션 웹의 설계와 구현은 후속 논의에서 정한다.
