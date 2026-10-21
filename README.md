# Not Yet Sayable: Latent Homes

V05의 첫 웹 프로토타입. 무료 정적 호스팅을 위한 HTML/CSS/JavaScript로 구성한다. 빌드나 서버 런타임 의존성이 없으며, 탐색 중 원본 DB나 AI를 호출하지 않는다.

## 현재 동작

- MapLibre + OpenFreeMap 청색 지도와 3D 건물·군집 기둥.
- 실제 지도 건물·도로의 형상을 샘플링한 GPU 점 질감과 조밀한 발광 군집. 장식용 점·기둥 수는 참여자 수가 아니며 통계는 별도 실제 레코드 집계만 사용한다.
- Pretendard 전용 UI, 사이언이 섞인 청색, 더 위에서 내려다보는 카메라, 군집 중심 빛기둥.
- 지도 전용 bloom 후처리: 밝은 영역 추출 → 저해상도 4회 분리 블러 → 원본 합성 + 미세한 정적 필름 그레인. HTML 글자에는 적용하지 않는다. 지도 변경 시에만 렌더링하며 상시 애니메이션 루프를 만들지 않는다.
- 런던·서울·뉴욕·파리 이동, 확대·축소, 지리적 군집 선택.
- 화면 영역 / 선택 군집의 공통 주제·키워드 집계.
- 주제·키워드 필터와 개별 기록의 과거·현재·미래 키워드 탐색.
- 한국어·영어, 모바일 패널, 키보드 포커스, 동작 줄이기 설정.
- 공개 manifest 30초 확인. 새 버전이 있을 때만 새 데이터 수신, 검증 성공 후 교체. 자동 갱신으로 카메라를 초기화하지 않는다.
- 배경 지도 연결 실패 시 키워드 탐색 유지. 갱신 실패 시 마지막 정상 데이터 유지.

**모든 데이터는 합성 데이터다.** 기존 V04의 참가자 원문·좌표·응답·이미지·비밀키는 복사하지 않았다. 지도 핀은 미래에 살고 싶은 곳을 뜻한다. 하나의 기록은 전체 시간대에 걸쳐 같은 키워드를 반복해도 한 번만 집계한다. 주제는 현재 기록의 대표 주제 기준으로 집계하며, 실제 분류 체계를 연결할 때 매핑을 점검해야 한다.

## 로컬 실행

Node.js 20 이상:

```sh
npm run dev
```

`http://127.0.0.1:4173`에서 확인한다. 정적 배포 디렉터리는 `dist/`다. `dist/vendor/`에 MapLibre GL JS 5.6.0, Pretendard Variable 1.3.9와 각각의 라이선스를 보관한다. 지도 타일·스프라이트는 OpenFreeMap에서 받는다. 글꼴은 사이트에서 직접 제공하며 다른 글꼴의 지도 레이블은 표시하지 않는다. 네트워크 없이 배경 지도를 완전히 재현하는 기능은 포함하지 않는다.

검증:

```sh
npm run check
```

## 실제 아카이브 연결

실제 자료 연결은 다음 단계다. 현재는 인증된 업로드 API나 Supabase 원본 접근을 구현하지 않았다.

공개 데이터는 `dist/data/manifest.json`과 해당 manifest가 가리키는 버전 파일로 구성된다. `schemaVersion: 1`, 문자열 `version`, `updatedAt`, `synthetic`, `locationMeaning: "desired-future-home"`, `records`를 사용한다. 한 레코드는 `id`, `position: [lng, lat]`, `theme`, `city`, `area`, `past`, `present`, `future`를 포함한다. 시간별 키워드는 `{id, ko, en}` 배열이다.

안전한 비공개 변환기에서 원본을 읽고 공개 가능한 필드만 새 버전 파일로 만든다. 새 데이터 파일과 manifest를 같은 배포에 포함한다. manifest의 `file`은 `data/archive.<version>.json` 형태다. 기존 파일 내용을 같은 버전 이름으로 덮어쓰지 않는다. 수정·삭제도 새 버전을 발행한다. 검증 실패나 배포 실패 시 마지막 정상 버전을 유지한다.

업로더의 작동 위치와 배포 주기는 후속 구현에서 정한다. 로컬 PC에서 발행기를 실행한다면 PC가 꺼져 있는 동안 최신화가 대기하지만 기존 사이트는 계속 열린다. 최초 버전에는 실제 자동 업로드·배포 프로그램이 포함되어 있지 않다.

`_headers`는 manifest의 재검증과 데이터 캐시를 설정한다. 호스팅 공급자의 경로 매칭 규칙에 맞춰 실제 적용을 확인한다. 사이트 탐색의 정적 파일 요청과 새 기록의 AI 처리·DB 저장은 별도 사용량이다.

## TD 네비게이션 준비

동일 origin의 임베디드 화면에서 다음 메시지를 받을 수 있다.

```js
frame.contentWindow.postMessage({ type: 'nys:navigate', city: 'seoul' }, location.origin);
frame.contentWindow.postMessage({ type: 'nys:navigate', unitId: 'LH-DEMO-0001' }, location.origin);
```

다른 origin의 TD 제어 브리지와 업로드 인증은 아직 연결하지 않았다. 서비스 역할 키를 브라우저에 넣지 않는다.

## 출처

- MapLibre GL JS: https://maplibre.org/ (BSD-3-Clause, `dist/vendor/MAPLIBRE-LICENSE.txt`)
- Pretendard: https://github.com/orioncactus/pretendard (SIL OFL 1.1, `dist/vendor/PRETENDARD-LICENSE.txt`)
- 지도: OpenFreeMap / OpenMapTiles / OpenStreetMap. 지도 출처 표시는 유지한다.
- 작품: Arrddon / Kiryung Nam, Not Yet Sayable: Latent Homes.

## 첫 버전의 한계

실제 작품 데이터와 분석 체계의 연결, 현장 TD 업로드·A/B 제어, 전시장 해상도에서의 성능, 새 데이터의 자동 발행은 후속 단계다. 기둥은 군집의 기록 수와 연결된 상징적 표현이며 건축물의 실제 높이를 의미하지 않는다. 표본 수는 합성 기록의 수다.
