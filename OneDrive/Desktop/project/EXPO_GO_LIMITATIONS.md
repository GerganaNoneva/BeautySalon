# Expo Go Ограничения

## ⚠️ Важно: Какво НЕ Работи в Expo Go

Вашето приложение използва функции които **НЕ са налични** в Expo Go:

### 1. Push Notifications (expo-notifications)
❌ **НЕ работи** в Expo Go
✅ **Работи** в development build

**Грешката която виждате:**
```
expo-notifications: Android Push notifications (remote notifications)
functionality provided by expo-notifications was removed from Expo Go
with the release of SDK 53. Use a development build instead of Expo Go.
```

**Какво означава:**
- Няма да получавате push notifications в Expo Go
- Няма да можете да тествате notification badges
- Notification функционалността е изключена автоматично

### 2. Voice Recording (expo-av)
✅ **Работи** в Expo Go на Android
✅ **Работи** в Expo Go на iOS

**Но:** Edge Functions за транскрипция изискват production Supabase setup.

## Решения

### Вариант 1: Продължете с Expo Go (Ограничено)

Можете да използвате приложението в Expo Go, но:

**Ще работи:**
- ✅ Login/Register
- ✅ График
- ✅ Клиенти
- ✅ Галерия
- ✅ Съобщения
- ✅ Профил
- ✅ Voice Recording (на устройството)

**НЯМА да работи:**
- ❌ Push Notifications
- ❌ Notification Badges
- ❌ Voice Transcription (изисква Supabase Edge Functions)

### Вариант 2: Development Build (Пълна Функционалност)

За пълна функционалност трябва **development build**:

#### Стъпка 1: Инсталирайте EAS CLI

```bash
npm install -g eas-cli
```

#### Стъпка 2: Login в Expo

```bash
eas login
```

#### Стъпка 3: Configure Build

```bash
eas build:configure
```

#### Стъпка 4: Build за Android

```bash
eas build --platform android --profile development
```

Това ще отнеме ~15-20 минути. След приключване:

1. Ще получите link за download на `.apk` файл
2. Изтеглете на телефона
3. Инсталирайте (може да трябва да разрешите "Unknown sources")
4. Отворете приложението

#### Стъпка 5: Start Dev Server

```bash
npm run dev
```

Сканирайте QR кода от development build приложението.

## Текущо Състояние на Функциите

### Notifications
- ✅ Код е имплементиран
- ✅ Expo Go detection добавен
- ✅ Graceful fallback
- ❌ Не работи без development build

### Voice Recording
- ✅ UI е готов
- ✅ Recording работи в Expo Go
- ✅ Edge Functions код е написан
- ❌ Transcription изисква production Supabase

## Как да Тествате в Expo Go

### 1. Ignorирайте Notification Warning

Червената грешка е само предупреждение. Можете:
- Да натиснете "Dismiss"
- Приложението ще работи нормално
- Notifications просто няма да се показват

### 2. Тествайте Останалите Функции

Всичко друго работи перфектно:

**График:**
- Създаване на резервации (ръчно)
- Преглед на свободни часове
- Управление на appointments

**Клиенти:**
- Преглед на списък с клиенти
- Phone verification
- Управление на профили

**Галерия:**
- Upload на снимки
- Likes и коментари
- Преглед

**Съобщения:**
- Изпращане/получаване
- Voice messages
- File attachments

**Voice Recording:**
- Може да запишете audio
- Но transcription няма да работи (изисква Edge Functions)

## Cost Estimate за Development Build

### Expo EAS Build
- **Free tier**: 30 builds/месец
- **Priority**: Unlimited builds ($29/месец)

### Build време
- Android: ~15-20 минути
- iOS: ~20-30 минути (изисква Mac за local build или EAS)

## Следващи Стъпки

### За Тестване СЕГА (Expo Go):
1. ✅ Dismiss warning-а за notifications
2. ✅ Тествайте основната функционалност
3. ✅ Login, създаване на резервации, галерия, etc.

### За Пълна Функционалност:
1. 📱 Създайте development build с EAS
2. 🔔 Тествайте notifications
3. 🎤 Setup Supabase Edge Functions за voice
4. 🚀 Deploy на production

## Troubleshooting

### "Cannot use Notifications in Expo Go"
- Нормално е! Просто dismiss warning-а
- Приложението ще работи без notifications

### "Voice transcription failed"
- Edge Functions не са deployed
- Вижте `VOICE_SETUP_REQUIREMENTS.md`

### "Build failed" (EAS)
- Проверете дали имате правилен `app.json`
- Проверете дали сте logged in: `eas whoami`
- Вижте logs: `eas build:view`

## Resources

- [Expo Development Builds](https://docs.expo.dev/develop/development-builds/)
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Expo Go Limitations](https://docs.expo.dev/bare/using-expo-client/)
