# 개역개정(KRV) 본문 데이터 저장

목표: NLT 100개와 동일한 구절 ID에 개역개정 원문 전체를 저장하고 화면에서 선택할 수 있도록 합니다.

개역개정은 저작권 보호 중이므로 앱 내 저장/배포 및 공개 GitHub 재배포 권한을 구분해 확인해야 합니다. 이 PR에는 본문을 복제하지 않습니다.

## 입력 JSON 구조

```json
{"translation":"KRV","entries":[{"id":"1-corinthians-13-4-5","reference":"1 Corinthians 13:4-5","verses":[{"number":4,"text":"허가받은 4절 원문"},{"number":5,"text":"허가받은 5절 원문"}]}]}
```

위 텍스트는 예시 자리표시자이며, 실제 입력은 data/scripture/nlt-popular-100.json에 있는 100개 ID/장절 전부와 해당 개역개정 본문을 포함해야 합니다.

## 변환/검증 명령

```bash
node scripts/build-scripture-krv-data.mjs /path/to/licensed-krv-100.json public/legacy/data/scripture-memory-100.ko-krv.json --confirmed-license
```

누락, 중복, 다른 절 번호 또는 빈 본문은 거부합니다. 원문의 띄어쓰기/맞춤법은 임의 변경하지 않습니다.

생성 결과는 공개 웹앱의 정적 데이터에 포함되므로, 배포 권한에 따라 별도 비공개 서버 저장소가 필요할 수 있습니다.
해당 파일이 없을 때 On_HARU는 기존 영어 NLT 화면으로 돌아가며, 한국어 성경 본문을 임의로 만들어 표시하지 않습니다.

공식 저작권 안내: https://www.bskorea.or.kr/bbs/board.php?bo_table=copyright_faq&device=mobile&page=1&sod=desc&sop=and&sst=wr_datetime&wr_id=1
