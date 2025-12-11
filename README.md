# CardioGuard MVP

نسخة مُحدّثة تشمل: Backend (Node.js) مع دعم Twilio اختياري، تطبيق Flutter محاكاة، مثال BLE، وإرشادات لبناء APK ونشر المشروع على GitHub.

## محتويات الحزمة
- backend/: Node.js Express backend (SQLite) - index.js, package.json, .env.example
- mobile/: Flutter minimal app - pubspec.yaml, lib/main.dart, lib/ble.dart
- README.txt & README.md
- LICENSE (MIT)
- .gitignore

## 1) رفع المشروع إلى GitHub (سهل)
افتح الـ terminal في مجلد `CardioGuard_MVP` ثم شغّل الأوامر التالية (مرة واحدة فقط):

```bash
git init
git add .
git commit -m "Initial CardioGuard MVP commit"
# أنشئ repo على GitHub يدوياً (مثلاً CardioGuard_MVP) ثم نفّذ:
git remote add origin https://github.com/YOUR_USERNAME/CardioGuard_MVP.git
git branch -M main
git push -u origin main
```

> ملاحظة: لو تحب أعمل أنا الـ repo على GitHub، أحتاج صلاحيات GitHub أو Access Token — حالياً أجهز لك الملفات وتقدر ترفعهم بنفسك بسهولة.

## 2) إعداد Twilio لإرسال SMS/مكالمات (اختياري)
- سجّل في Twilio وخُذ `ACCOUNT_SID` و`AUTH_TOKEN` ورقم Twilio (FROM_NUMBER).
- ضع القيم في متغيرات البيئة أو أنشئ ملف `.env` في `backend/` باستخدام `.env.example`.
- backend/index.js يحتوي على وظائف `sendSms()` لاستخدام Twilio. ثبت الحزمة:
```bash
cd backend
npm install twilio
# ثم شغّل السيرفر
node index.js
```

## 3) بناء APK لتجربة على جهاز Android
لتجهيز APK نهائي تحتاج Flutter وAndroid SDK منصّبين على جهازك.

### خطوات سريعة (Debug APK)
1. افتح `mobile/` في Android Studio أو VS Code.
2. شغّل:
```bash
flutter pub get
flutter build apk --debug
```
Debug APK سيُوجد في `build/app/outputs/flutter-apk/app-debug.apk`

### خطوات لإنتاج APK موقّع (Release)
1. اتبع دليل Flutter الرسمي لتوقيع التطبيقات: https://flutter.dev/docs/deployment/android#signing-the-app
2. ثم شغّل:
```bash
flutter build apk --release
```
3. استخدم `apksigner` لتوقيع الـ APK أو اتبع خطوات Gradle لتوليد APK موقّع.

## 4) دمج BLE مع الساعة
- المثال في `mobile/lib/ble.dart` يشرح كيفية المسح والاتصال. تحتاج أن تفعل صلاحيات Android (AndroidManifest) وiOS (Info.plist).
- خطوط عامة:
  - أضف صلاحيات الـ Location وBluetooth في AndroidManifest.xml.
  - استخدم `flutter_blue` لقراءة خصائص (characteristics) من الساعة وتمرر القيم (HR, ACCEL) إلى الخادم.

## 5) تشغيل سريع (local)
1. شغّل backend:
```bash
cd backend
npm install
node index.js
```
2. سجّل المستخدم التجريبي (استبدل الأرقام):
```bash
curl -X POST http://localhost:3000/api/register -H "Content-Type: application/json" -d '{"name":"يوسف نبيه عبدالحليم","phone":"010xxxxxxx","emergency_contact":"+2012yyyyyyy"}'
```
3. شغّل التطبيق في المحاكي أو موبايل وأجعل `userId` = قيمة `user_id` الراجعة.


صاحب المشروع: يوسف نبيه عبدالحليم
