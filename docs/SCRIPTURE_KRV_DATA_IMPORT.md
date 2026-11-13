# 개역개정(NKRV) 본문 데이터 저장

목표: NLT 100개와 동일한 구절 ID에 개역개정 원문 전체를 저장하고 화면에서 선택할 수 있도록 합니다.

개역개정은 저작권 보호 중이므로 앱 내 저장/배포 및 공개 GitHub 재배포 권한을 구분해 확인해야 합니다. 이 PR에는 본문을 복제하지 않습니다.

## 입력 JSON 구조

```json
{"translation":"NKRV","entries":[{"id":"1-corinthians-13-4-5","reference":"1 Corinthians 13:4-5","verses":[{"number":4,"text":"허가받은 4절 원문"},{"number":5,"text":"허가받은 5절 원문"}]}]}
```

위 텍스트는 예시 자리표시자이며, 실제 입력은 data/scripture/nlt-popular-100.json에 있는 100개 ID/장절 전부와 해당 개역개정 본문을 포함해야 합니다.

## 변환/검증 명령

```bash
node scripts/build-scripture-krv-data.mjs /path/to/licensed-krv-100.json public/legacy/data/scripture-memory-100.ko-nkrv.json --confirmed-license
```

누락, 중복, 다른 절 번호 또는 빈 본문은 거부합니다. 원문의 띄어쓰기/맞춤법은 임의 변경하지 않습니다.

생성 결과는 공개 웹앱의 정적 데이터에 포함되므로, 배포 권한에 따라 별도 비공개 서버 저장소가 필요할 수 있습니다.
해당 파일이 없을 때 On_HARU는 기존 영어 NLT 화면으로 돌아가며, 한국어 성경 본문을 임의로 만들어 표시하지 않습니다.

공식 저작권 안내: https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=mobile&page=1&sod=desc&sop=and&sst=wr_datetime&wr_id=1

## 번역본 식별자 정정

`NKRV`는 개역개정(1998)이고, `KRV`는 개역한글(1961)을 뜻합니다. 데이터의 `translation` 필드는 반드시 `NKRV`입니다. 이전 PR의 `KRV` 표기는 수정된 것입니다.

## 발견한 외부 데이터 후보 (2026-11-13 확인)

- 대한성서공회 웹 페이지에서 GAE(개역개정) 본문을 수집한 JSON 데이터셋: https://github.com/dev-dooD/bible-crawler
  - 원본 파일: `bible_data.json` (약 15.2 MB), 구조는 `books[].id / chapters[].chapter / verses[].verse / text.GAE`.
  - 변환기는 이 파일을 직접 입력받아, 기존 NLT 참조 목록에 해당하는 **100개 본문 / 121절만** 추출합니다. 66권 전체는 앱에 포함하지 않습니다.
- 다른 출처: https://sieon-dev.tistory.com/127 (개역개정이라고 표기한 4.88 MB JSON; 출처/이용허락 검증 전에는 단정하지 않음).
- 대한성서공회 저작권 및 웹서비스 허가 조건: https://www.bskorea.or.kr/bbs/content.php?co_id=subpage2_3_4_3

### 허가된 원본 파일에서 추출

```bash
node scripts/build-scripture-krv-data.mjs /path/to/bible_data.json public/legacy/data/scripture-memory-100.ko-nkrv.json --confirmed-license
```

**주의:** 공개 저장소의 원문 파일이 곧 재배포 허가를 의미하지 않습니다. 웹앱의 정적 리소스는 누구나 내려받을 수 있으므로, 실제로 계약에 웹 배포·다운로드 및 원문 파일 제공이 허용되는지 확인한 경우에만 생성 파일을 배포하세요. 단순한 개인 열람 허가와 공개 JSON 저장 권한은 구별됩니다.

이 브랜치에는 변환 코드와 합성 테스트만 포함하며, 외부에서 발견한 저작권 본문은 커밋하지 않습니다.
