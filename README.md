# Pilot Logbook

비행기록(로그북) PDF·사진을 읽어 월별/연도별로 정리해 주는 웹앱입니다.
A380 PIC Time / Auditor Time 자동 분류, CSV 내보내기·가져오기, 연도별 아카이브,
Google 계정으로 여러 기기(아이패드·폰·PC) 간 동기화를 지원합니다.

## 실행 방법

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:5173` 을 열고 로그북 PDF/JPG/PNG(또는 이 앱에서
Export한 CSV)를 업로드하면 됩니다.

## 여러 기기에서 동기화 (Firebase, 선택사항)

Firebase 설정 없이도 앱은 브라우저 저장소만으로 동작합니다. 아이패드·폰·PC에서
같은 데이터를 보려면 Firebase 프로젝트를 하나 만들어 연결하세요.

1. [Firebase Console](https://console.firebase.google.com)에서 새 프로젝트 생성 (무료 Spark 플랜이면 충분).
2. 프로젝트에 **웹 앱**을 추가하고 표시되는 `firebaseConfig` 값을 확인.
3. **Authentication → Sign-in method**에서 **Google** 로그인 활성화.
4. **Firestore Database** 생성(프로덕션 모드) 후, 이 저장소의 `firestore.rules`
   내용을 규칙으로 배포: `firebase deploy --only firestore:rules`
   (규칙: 각 사용자는 자기 문서 `logbooks/{uid}`만 읽고 쓸 수 있음)
5. 프로젝트 루트에 `.env.local` 파일을 만들고 값 입력:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=<프로젝트>.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=<프로젝트 ID>
VITE_FIREBASE_APP_ID=...
```

6. 앱을 다시 빌드/실행하면 헤더에 **Sign in with Google** 버튼이 나타납니다.
   각 기기에서 같은 Google 계정으로 로그인하면 로그북이 자동 동기화됩니다.
   - 로그인 시 기기에 있던 기록과 클라우드 기록이 자동 병합됩니다(중복 제거).
   - 업로드·연도 삭제·Clear 등 모든 변경이 즉시 클라우드에 반영되고,
     다른 기기에는 실시간으로 내려옵니다.

배포(호스팅)는 `npm run build` 후 `dist` 폴더를 Firebase Hosting, Netlify,
GitHub Pages 등 아무 정적 호스팅에 올리면 됩니다. 배포 도메인을
Firebase Console의 **Authentication → Settings → Authorized domains**에 추가하세요.

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

## 연도별 아카이브

- 연도 카드의 **Export {연도} CSV**로 그 해 기록을 파일로 보관
- **Remove year**로 지난 연도를 삭제해 앱을 가볍게 유지
- 보관한 CSV는 언제든 드롭존에 올려 다시 볼 수 있습니다
