# Pilot Logbook

비행기록(로그북) PDF·사진을 읽어 월별/연도별로 정리해 주는 웹앱입니다.

기능:

- **A380 PIC Time** / **Auditor Time** 자동 분류
- **업로드 검수 단계** — 사진·PDF·CSV로 읽은 각 편을 확인·수정한 뒤에만 저장
- **개별 비행 직접 입력** (`+ Add flight`) — 프린트물이 없는 편도 손으로 기록
- CSV 내보내기·가져오기
- **월별 CSV 내보내기**, 비행 한 편 단위 삭제
- 연도별 아카이브 (Export + Remove)
- Google 계정으로 아이패드·폰·PC 간 동기화 (Firebase, 선택)

## 실행 방법

```bash
npm install
npm run dev
npm test     # 삭제 · 수동 입력 동작 테스트 (선택)
```

브라우저에서 `http://localhost:5173` 을 열고 로그북 PDF, JPG, PNG(또는 이 앱에서 Export한 CSV)를 업로드하면 됩니다.

**팁:** AFLIS Flight Log는 **PDF로 저장**해 올리는 것이 가장 정확합니다. 사진·캡처는 JPG/PNG를 사용하세요 (iPhone HEIC는 지원하지 않습니다 — 공유 → 옵션 → 호환성 우선).

## 여러 기기에서 동기화 (Firebase, 선택사항)

Firebase 설정 없이도 앱은 브라우저 저장소만으로 동작합니다. 아이패드·폰·PC에서 같은 데이터를 보려면 Firebase 프로젝트를 연결하세요.

1. [Firebase Console](https://console.firebase.google.com)에서 새 프로젝트 생성 (무료 Spark 플랜이면 충분).
2. 프로젝트에 **웹 앱**을 추가하고 표시되는 `firebaseConfig` 값을 확인.
3. **Authentication → Sign-in method**에서 **Google** 로그인 활성화.
4. **Firestore Database** 생성(프로덕션 모드) 후, 이 저장소의 `firestore.rules` 내용을 규칙으로 배포:

   ```bash
   firebase deploy --only firestore:rules
   ```

   (각 사용자는 자기 문서 `logbooks/{uid}`만 읽고 쓸 수 있음)

5. 프로젝트 루트에 `.env.local` 파일을 만들고 값 입력:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<프로젝트>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<프로젝트 ID>
VITE_FIREBASE_APP_ID=...
```

6. 앱을 다시 빌드/실행하면 헤더에 **Sign in with Google** 버튼이 나타납니다. 각 기기에서 같은 Google 계정으로 로그인하면 로그북이 자동 동기화됩니다.
   - 로그인 시 기기에 있던 기록과 클라우드 기록이 자동 병합됩니다(중복 제거).
   - 업로드·연도 삭제·Clear 등 모든 변경이 즉시 클라우드에 반영되고, 다른 기기에는 실시간으로 내려옵니다.

### 동기화가 안 될 때

헤더의 상태 표시가 진단입니다.

| 표시 | 뜻 |
|---|---|
| `Synced` | 정상 |
| `Syncing…` | 저장 중 |
| `Offline — saved on this device` | 서버에 닿지 못함. 기록은 이 기기에 안전하게 남아 있음 |
| `Sync error` | 실패. 화면에 Firestore의 원인 코드가 함께 표시됨 |

`Sync error`의 원인 코드별 대처:

- `permission-denied` — Firestore 규칙이 배포되지 않았습니다. `firebase deploy --only firestore:rules`
- `unavailable` / `failed-precondition` — Firestore 데이터베이스가 생성되지 않았거나 네트워크가 막혀 있습니다.
  광고 차단기·회사 네트워크가 `firestore.googleapis.com`을 막는 경우가 흔합니다
- `unauthenticated` — 로그아웃 후 다시 로그인

## 배포 (아이패드·폰에서 쓰기)

로컬(`localhost`)은 이 PC에서만 됩니다. 다른 기기에서 쓰려면 Firebase Hosting에 배포하세요.

1. `.firebaserc`의 `YOUR_FIREBASE_PROJECT_ID`를 본인 Firebase **프로젝트 ID**로 바꿉니다.
2. `.env.local`에 실제 Firebase 웹 앱 설정값 4개가 들어 있는지 확인합니다.  
   (`VITE_FIREBASE_USE_EMULATOR`는 비우거나 삭제 — 배포 빌드에는 넣지 마세요.)
3. 터미널에서:

```bash
npx firebase-tools login
npm run deploy
```

4. 끝나면 `https://<프로젝트ID>.web.app` 주소가 나옵니다.
5. Firebase Console → **Authentication → Settings → Authorized domains**에 그 도메인(`*.web.app`)이 있는지 확인합니다 (보통 자동 추가됨).
6. 아이패드·폰 브라우저에서 그 주소를 열고 **Sign in with Google** → 같은 계정으로 로그인하면 동기화됩니다.

홈 화면에 추가(아이패드: 공유 → 홈 화면에 추가)하면 앱처럼 쓸 수 있습니다.

## 로컬 개발용 에뮬레이터 테스트

실제 Firebase 프로젝트 없이 동기화를 테스트하려면:

```bash
npx firebase-tools emulators:start --project demo-pilot-logbook --only auth,firestore
```

`.env.local`에 아래처럼 더미 값과 에뮬레이터 플래그를 넣고 dev 서버를 실행:

```bash
VITE_FIREBASE_API_KEY=demo
VITE_FIREBASE_AUTH_DOMAIN=demo-pilot-logbook.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-pilot-logbook
VITE_FIREBASE_APP_ID=demo
VITE_FIREBASE_USE_EMULATOR=true
```

## 업로드 검수 (Review before importing)

파일을 올리면 곧바로 저장되지 않고 **검수 화면**이 먼저 열립니다. 읽어낸 편이 월별로 묶여 표로 나오고,
프린트물과 한 줄씩 대조하면서 확인한 뒤 **Import** 를 눌러야 로그북에 반영됩니다.

- 각 행의 **체크박스**로 넣을 편만 선택, 월 헤더 체크박스로 그 달 전체 선택/해제
- **Edit** 를 누르면 그 행이 펼쳐져 모든 항목을 그 자리에서 수정 가능
- 의심스러운 행은 자동으로 표시됩니다:
  - 달력에 없는 날짜, 미래 날짜
  - 기종 누락, 편명 누락, 구간이 3-Letter 공항 코드가 아님, 출발지=도착지
  - Flight Time 0:00, 비정상적으로 긴 Flight Time(19시간 초과)
  - **Flight Time > Duty Time** (열이 밀려 읽힌 전형적인 OCR 오류)
  - Night/Instrument Time이 Flight Time보다 김
  - 같은 파일 안의 중복 행(빨강, 반드시 해제하거나 수정해야 Import 가능)
  - 이미 로그북에 있는 편(파랑, 중복 추가가 아니라 갱신됨)
- 빨간색(error) 행이 선택되어 있으면 Import 버튼이 잠깁니다 — 고치거나 체크를 해제하세요
- **직접 수정한 행은 기존 값을 덮어쓰고**, 손대지 않은 행은 기존 값을 지키며 빈 칸만 채웁니다
  (흐릿한 재촬영본이 먼저 읽은 PDF의 좋은 값을 망가뜨리지 않게)
- CSV를 올리면 그 CSV가 다루는 연도가 교체되므로, **파일에 없는 기존 편 목록**이 아래에 따로 표시됩니다.
  지우고 싶지 않은 편은 여기서 체크해 두면 남습니다
- **Discard** 를 누르면 아무것도 저장되지 않습니다

## Career summary — 기준값 + 이후 합산

**Total / Night / Instrument = 업로드한 AFLIS PDF의 값(기준값) + 그 이후 기록된 시간 합계**

- PDF 헤더의 누적 시간은 *출력 시점의 스냅샷*이므로, 그 리포트의 **마지막 비행일(as of)** 을 함께 저장하고
  그 날짜 이후 기록만 더합니다 (이미 포함된 편을 중복으로 더하지 않음)
- 여러 PDF를 올리면 **항상 큰 값**이 기준으로 남습니다. 누적 시간은 줄어들 수 없으므로,
  오래된 리포트나 잘못 읽힌 헤더가 기준값을 끌어내리지 못합니다
- 헤더 판독에는 3중 검증이 들어갑니다 — 6개 이상의 시간 값이 연속으로 나올 것,
  총 비행시간이 그중 최대일 것, 그 파일에 적힌 비행시간 합계보다 작지 않을 것.
  하나라도 어긋나면 기준값을 아예 쓰지 않습니다 (예전에 `2:34` 같은 값이 들어가던 원인)
- 그래도 값이 이상하면 Career summary 카드의 **Edit baseline**에서 총 비행시간과 기준일을 직접 입력할 수 있습니다
- Type / CAP / Captain 세 항목은 **리포트에 적힌 값 그대로**입니다.
  기장 시간은 그 편에서의 좌석(PIC 여부)에 달려 있는데 비행 기록에는 그 정보가 없어, 합산하면 틀린 값이 될 수 있습니다

## 개별 비행 직접 입력

헤더의 **+ Add flight**, 또는 각 **월 카드 헤더의 + Add flight** 버튼을 누르면 한 편(sector)을 손으로 입력하는 폼이 열립니다.
월 카드에서 열면 그 달의 마지막 비행 날짜·기종·기번이 미리 채워지므로, 지난 달에 빠진 편을 넣을 때 날짜를 다시 고칠 필요가 없습니다.
AFLIS 출력물에 없는 편(페리·시뮬·OCR이 못 읽은 줄)을 그때그때 기록할 때 쓰세요.

- 시간은 `9:30` 같은 **H:MM** 또는 `9.5` 같은 **소수 시간** 둘 다 받습니다
- Duty Code에 `Z`가 들어가거나 기종이 A380이 아니면 자동으로 **Auditor Time**으로 분류됩니다 (폼 하단에 미리 표시)
- **날짜·편명·구간·기번이 모두 같은 기록이 이미 있으면 덮어씁니다** — OCR이 잘못 읽은 줄을 고칠 때 이 방법을 쓰면 됩니다
- 한 편을 저장하면 날짜·기종·기번은 그대로 두고 도착지가 다음 편의 출발지로 넘어가므로, 연속 구간을 빠르게 이어 입력할 수 있습니다

## 삭제 · 아카이브

- 월 카드를 펼치면 각 행 오른쪽에 **Delete** — 확인 창에서 해당 편(날짜·편명·구간·시간)을 확인하고 그 한 편만 삭제
- 월 카드 헤더의 **Export CSV**로 그 달만 따로 저장
- 연도 카드의 **Export {연도} CSV**로 그 해 기록을 파일로 보관
- **Remove year**로 지난 연도를 삭제해 앱을 가볍게 유지
- 모든 삭제는 로그인 상태면 클라우드·다른 기기에도 그대로 반영됩니다
- 보관한 CSV는 언제든 드롭존에 올려 다시 볼 수 있습니다

## 비행 분류 규칙

- **Auditor Time:** A380이 아닌 기종, 또는 Duty Code에 `Z`가 포함된 편
- **A380 PIC Time:** 나머지 A380 편
- Auditor 편은 날짜순 테이블에 그대로 두고 연한 색으로 표시
- Duty Code는 항상 표시, T/O·L/D는 해당 시 `1`로 표시
