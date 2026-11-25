# Renesans Tadbirlar — Android demo

Android ilovasi universitet tadbirlari saytining mobil ko‘rinishini telefonda ochadi. Bu build offline demo: namunaviy tadbirlar va demo rollari qurilmaning o‘zida saqlanadi.

## APKni yuklab olish

Har bir `main` branch yangilanishidan so‘ng GitHub Actions APKni yig‘ib, `download/Renesans_Tadbir.apk` fayliga joylaydi. Uni repozitoriydagi `download` papkasidan yuklab olib, Android telefonda o‘rnating. APK debug kaliti bilan imzolangan; Android sozlamasida brauzerdan ilova o‘rnatishga ruxsat so‘ralishi mumkin.

## Demo cheklovi

Hozirgi APK serverga ulanmaydi. Shuning uchun universitet hisobiga kirish, foydalanuvchilar o‘rtasida umumiy ma’lumotlar va haqiqiy universitet NB buyrug‘i ishlamaydi. Bu imkoniyatlarni yoqish uchun Python backendni HTTPS manziliga joylashtirib, Android ilovasini o‘sha server manziliga ulash kerak.

## Manbadan yig‘ish

- Android Gradle Plugin 8.6.1, Gradle 8.7, Java 17, Android SDK 35.
- Android Studio’da ushbu papkani oching va `app` modulini `assembleDebug` vazifasi bilan yig‘ing.
- Yoki terminaldan: `gradle assembleDebug`.
- Build natijasi: `app/build/outputs/apk/debug/app-debug.apk`.

WebView ichki HTML/CSS/JavaScript va rasmlarni ilova bilan birga saqlaydi; fayl tanlash va hisobotni PDFga chiqarish Android bilan bog‘langan.
