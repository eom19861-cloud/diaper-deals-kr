# 기저귀·물티슈 쿠팡 단가 비교 (1매당 최저가)

쿠팡에서 파는 상품만 모아 — 같은 돈이면 몇 매를 사는지 — 기저귀와 아기 물티슈를 **1매당 가격**으로 비교하는 정적 웹앱입니다.
빌드 과정이 없어서 GitHub에 올린 그대로 Vercel에서 서빙됩니다.

- 카테고리: 기저귀 / 아기 물티슈 / 직접 단가 계산기
- 데이터: `data/products.json`의 모든 품목이 **쿠팡 판매가·쿠팡 링크** 기준입니다
- 필터: 기저귀(브랜드·단계·팬티형/밴드형), 물티슈(브랜드·캡형/리필형)
- 정렬: **1매당 최저가순(기본)**, 총 구매가순, 최신 갱신순
- 상단에 마지막 확인 시각(`updatedAt`) 표시
- 쿠팡파트너스 대비: `data/config.json`의 `partnersEnabled` 한 줄로 고지 문구와 제휴 링크 표시가 켜집니다

## 구조

```
index.html          화면 골격
styles.css          모바일 퍼스트 스타일
app.js              데이터 로딩·필터·정렬·단가 계산
data/products.json  상품 데이터 (매일 이 파일만 교체)
data/config.json    사이트 문구·파트너스 설정
```

## 매일 갱신하는 법

`data/products.json`에서 두 가지만 바꾸면 됩니다.

1. `updatedAt` — 화면 상단 "최저가 확인 … 기준"에 그대로 표시됩니다.
2. `items` — 상품별로 아래 필드를 갱신합니다.

```json
{
  "id": "huggies-maxdry-band-4",
  "category": "diaper",          // diaper | wipe
  "brand": "하기스",
  "name": "하기스 맥스드라이 뉴 공용 대형 밴드형",
  "stage": 4,                    // 기저귀만: 단계(4~7) / 물티슈는 null
  "type": "밴드형",               // 기저귀만: 팬티형 | 밴드형
  "form": null,                  // 물티슈만: 캡형 | 리필형
  "packLabel": "60매 × 2팩 = 총 120매",
  "totalCount": 120,             // 총 매수 (단가 계산의 분모)
  "totalPrice": 48400,           // 쿠팡 판매가
  "shipping": 0,                 // 배송비 (무료면 0)
  "seller": "쿠팡 로켓배송",
  "unitPrice": 403,              // 참고값. 화면은 직접 계산하므로 안 맞으면 화면 값이 맞습니다
  "url": "https://www.coupang.com/vp/products/8353195786",  // 쿠팡 상품 페이지 또는 쿠팡 검색 링크
  "partnerUrl": null,            // 파트너스 승인 후 제휴 링크
  "note": "대형 9~13kg · 밴드형 중 최저 단가",
  "checkedAt": "2026-11-17"      // 최신 갱신순 정렬에 사용
}
```

**단가 규칙:** `1매당 = (totalPrice + shipping) ÷ totalCount`. 화면 표시는 원 단위 반올림.

## 쿠팡파트너스 켜기

1. 쿠팡파트너스 승인 후 `data/config.json`에서
   - `partnersEnabled`를 `true`로,
   - `partners.affiliateId`를 발급받은 ID로 채웁니다.
2. 상품별 `partnerUrl`에 제휴 링크를 넣습니다. `partnerUrl`이 비어 있으면 원래 `url`로 이동합니다.
3. `partnersEnabled`가 `true`이면
   - 히어로 바로 아래에 **필수 고지 문구**(`partnersNotice`) 배너가 항상 표시되고,
   - `partnerUrl`이 있는 카드에는 구매 버튼 아래에 **`COUPANG` + 제휴 링크 주소**(`link.coupang.com/...`)가 함께 표시되며,
   - 구매 버튼과 제휴 링크에 `rel="sponsored"`가 붙습니다.

고지 문구와 제휴 링크 표기는 쿠팡파트너스 심사(대가성 문구·링크 노출)에서 확인하는 항목이라 지우지 마세요.

> 쿠팡파트너스는 제휴 링크로 발생한 구매에 수수료를 지급하며, 고지 문구 노출이 필수입니다.
> 가격·재고는 파트너스 API 약관상 별도 계약이 필요할 수 있으니, 자동 수집 전에 약관을 확인하세요.

## 로컬에서 보기

`fetch`로 JSON을 읽기 때문에 `file://`로는 동작하지 않습니다. 정적 서버로 띄우세요.

```bash
python3 -m http.server 8000
# http://localhost:8000
```

## Vercel 배포

Vercel → **Add New → Project → 이 저장소 Import** → Framework Preset `Other`,
Build Command 비움, Output Directory 비움 → Deploy. `index.html`이 루트에 있어 바로 서빙됩니다.

## 데이터 출처

2026-11-17 기준 쿠팡에서 판매 중인 상품의 공개 판매가(무료배송 기준)를 수집했습니다.
각 상품의 `url`은 쿠팡 상품 페이지이거나 해당 상품의 쿠팡 검색 결과이며, 실제 결제 금액은 쿠폰·카드 할인·와우회원 혜택으로 달라질 수 있습니다.
