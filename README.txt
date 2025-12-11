CardioGuard MVP
===============

محتوى الحزمة:
- backend/: Node.js Express backend (SQLite) - index.js, package.json
- mobile/: Flutter minimal app - pubspec.yaml, lib/main.dart

تعليمات تشغيل الـ Backend (محلي):
1. تأكد أنك منصب Node.js و npm.
2. افتح terminal وادخل مجلد backend:
   cd CardioGuard_MVP/backend
3. ثبت الحزم:
   npm install
4. شغل السيرفر:
   node index.js
   السيرفر هيشتغل على http://localhost:3000

إضافة مستخدم تجريبي (باستخدام curl أو Postman):
curl -X POST http://localhost:3000/api/register -H "Content-Type: application/json" -d '{"name":"يوسف نبيه عبدالحليم","phone":"010xxxxxxx","emergency_contact":"012yyyyyyy"}'

تعليمات تشغيل تطبيق Flutter (محلي):
1. ثبت Flutter SDK واتبع خطوات التشغيل المعتادة.
2. افتح مشروع mobile/ في Android Studio أو VS Code.
3. شغل:
   flutter pub get
4. شغّل على محاكي Android (يفضل) أو جهاز حقيقي.
ملاحظة: التطبيق يستخدم http://10.0.2.2:3000 كمضيف للوصول إلى السيرفر عند تشغيله على محاكي Android.

ملاحظات مهمة:
- الكود MVP تعليمي ويحتاج تعديلات للاستخدام الفعلي.
- للتواصل مع خدمات الطوارئ أو إرسال SMS/اتصالات يجب إضافة تكامل بمزود رسائل (مثل Twilio) وإجراء موافقات قانونية.
- قبل الإطلاق التجاري يلزم اختبارات طبية وتنظيمية.

صاحب المشروع: يوسف نبيه عبدالحليم
