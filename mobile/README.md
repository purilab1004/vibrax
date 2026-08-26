# Vibrexcup — 모바일 앱 (React Native / Expo)

vibrexcup.com 을 감싸는 네이티브 앱. 게임·스튜디오·AI·신경망 등 모든 기능은 웹에서 그대로 돌아가고,
앱은 **네이티브 껍데기 + 네이티브 통합(구글 로그인·결제·푸시·권한)**을 담당한다.
(전체를 RN 으로 재작성하는 대신 이 방식이 현실적 — 기능 중복 없이 스토어 출시 가능)

## 로컬 실행
```bash
cd mobile
npm install
npx expo start          # QR 코드 → Expo Go 앱(개발용) 또는
npx expo run:ios        # iOS 시뮬레이터 (Xcode 필요)
npx expo run:android    # Android 에뮬레이터 (Android Studio 필요)
```

## 스토어 빌드 (EAS)
```bash
npm i -g eas-cli
eas login
eas build:configure       # projectId 발급 → app.json extra.eas.projectId 에 자동 기입
eas build -p ios --profile production
eas build -p android --profile production
eas submit -p ios         # App Store Connect 업로드
eas submit -p android      # Play Console 업로드
```
