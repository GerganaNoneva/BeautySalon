# Voice Reservation Feature - Troubleshooting Guide

## 📊 Разбиране на Грешките

### ✅ "Network request failed" → ОПРАВЕНО!
Това означаваше че URL polyfill липсваше или FormData не работеше правилно.
**Статус:** Оправено с URL polyfill и React Native FormData формат.

### 🔍 "Грешка при парсиране (400) - Parsing failed"
Това означава че:
- ✅ Network connection работи
- ✅ Audio е качен успешно
- ✅ Transcription е успешна (Whisper API работи)
- ❌ **OpenAI GPT-4o API връща грешка** при опит да parse-не текста

**Възможни причини:**

#### 1. OpenAI API Key е невалиден
- Решение: Проверете дали API key-ът е копиран правилно
- Генерирайте нов от: https://platform.openai.com/api-keys

#### 2. OpenAI API Key няма достъп до gpt-4o-mini
- Решение: API key-ът трябва да е от проект с достъп до GPT-4o модели
- Старите free tier keys нямат достъп до gpt-4o-mini

#### 3. OpenAI billing/quota проблеми
- Решение: Добавете payment method в OpenAI акаунта
- Проверете: https://platform.openai.com/account/billing

#### 4. Rate limiting
- Решение: Изчакайте 1-2 минути и опитайте отново

**Как да тествате API key-а:**
```bash
# Test API key директно
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_API_KEY"

# Ако е валиден, ще видите списък с модели
# Ако е невалиден, ще видите: { "error": { "message": "Incorrect API key..." } }
```

---

## Проблем: "Network request failed" (archived)

### Какво означаваше:
Мобилното приложение **не можеше да се свърже** с Supabase Edge Functions поради:
1. Missing URL polyfill
2. Неправилен FormData формат за React Native
3. Missing permissions

### ✅ Решение (ПРИЛОЖЕНО):

Направих следните промени за да се оправи проблемът:

#### 1. Добавен URL Polyfill в `app/_layout.tsx`

```typescript
import 'react-native-url-polyfill/auto';
```

Това е **критично важно** за React Native! Без него fetch requests към Supabase не работят.

#### 2. Поправен FormData за React Native

React Native's FormData работи **различно** от web браузъра:

**ПРЕДИ (не работи в RN):**
```typescript
const audioBlob = await fetch(uri).then((r) => r.blob());
formData.append('audio', audioBlob, 'recording.m4a');
```

**СЛЕД (работи в RN):**
```typescript
formData.append('audio', {
  uri: uri,
  type: 'audio/m4a',
  name: 'recording.m4a',
} as any);
```

#### 3. Добавени iOS/Android Permissions в `app.json`

```json
{
  "ios": {
    "infoPlist": {
      "NSMicrophoneUsageDescription": "...",
      "NSCameraUsageDescription": "..."
    }
  },
  "android": {
    "permissions": [
      "RECORD_AUDIO",
      "CAMERA",
      ...
    ]
  }
}
```

### 🧪 Какво да направите сега:

#### Стъпка 1: Уверете се че OPENAI_API_KEY е добавен

Вижте: `VOICE_SETUP_REQUIREMENTS.md` за детайли.

Накратко:
```bash
# Dashboard метод (препоръчително)
1. https://supabase.com/dashboard/project/wbkkchcgnehauypaysen/settings/vault/secrets
2. Add secret: OPENAI_API_KEY
3. Value: вашият OpenAI API key
```

#### Стъпка 2: Рестартирайте Expo приложението

**ВАЖНО:** След промените трябва да **рестартирате Expo dev server и приложението**!

1. В терминала където работи `npm run dev`:
   - Натиснете `Ctrl+C` (спрете сървъра)
   - Стартирайте отново: `npm run dev`

2. На телефона:
   - **Затворете напълно Expo Go приложението** (не просто minimize)
   - Изтрийте от background apps (swipe up/away)
   - Отворете отново Expo Go
   - Scan QR кода отново

#### Стъпка 3: Тествайте Voice Reservation

1. Login в приложението
2. Отидете в **График** tab
3. Кликнете **микрофон иконата**
4. Говорете резервация: *"Петък от три и половина до пет, гел лак, за Мария Иванова"*
5. Кликнете отново микрофона за да спрете
6. Изчакайте "Обработка..."

### 🎯 Очаквани Резултати:

#### ✅ Ако всичко работи:
```
Console logs:
  Uploading audio to transcribe...
  Transcription response: { text: "..." }
  Transcribed text: петък от три и половина до пет гел лак за мария
  Parsing reservation...
  Parsed reservation: { customerName: "Мария", service: "Гел лак", ... }

UI:
  → Reservation modal се отваря
  → Полетата са автоматично попълнени! 🎉
```

#### ❌ Ако все още има грешка:

**Грешка: "Network request failed"**
- Проблем: Не сте рестартирали приложението
- Решение: Затворете напълно Expo Go и стартирайте отново

**Грешка: "OpenAI API Key не е конфигуриран"**
- Проблем: Secret не е добавен в Supabase
- Решение: Вижте Стъпка 1 по-горе

**Грешка: "401 Unauthorized"**
- Проблем: Session е изтекла
- Решение: Logout и login отново

**Грешка: "500 Internal Server Error"**
- Проблем: Edge Function грешка
- Решение: Проверете Edge Function logs в Supabase Dashboard

### 🔍 Debugging Tips:

#### Проверка на Console Logs

Отворете Expo console и потърсете:

```bash
# Успешен request:
Uploading audio to transcribe...
Transcription response: {...}
Transcribed text: ...
Parsing reservation...
Parsed reservation: {...}

# Network грешка:
Network error: [TypeError: Network request failed]
Error details: {...}

# API Key липсва:
Transcribe error: 500 ...
OpenAI API key not configured
```

#### Проверка на Network Connectivity

```bash
# От телефона, отворете Safari/Chrome и посетете:
https://wbkkchcgnehauypaysen.supabase.co

# Трябва да видите: "ok" или Supabase landing page
# Ако видите грешка → Network проблем
```

#### Проверка на Edge Functions Status

```bash
# От browser:
https://supabase.com/dashboard/project/wbkkchcgnehauypaysen/functions

# Трябва да видите:
- transcribe (Active, green)
- parse-reservation (Active, green)
```

### 📱 Expo Go Ограничения

Expo Go има известни ограничения:

1. **Network requests** понякога са блокирани от iOS/Android security policies
2. **Microphone/Camera** permissions може да изискват native build (не Expo Go)
3. **Background tasks** не работят в Expo Go

Ако след всички стъпки **все още не работи**, може да се наложи да създадете **development build** вместо да използвате Expo Go:

```bash
# Изграждане на development build
npx expo install expo-dev-client
eas build --profile development --platform ios
# или
eas build --profile development --platform android
```

**Но първо опитайте стъпките по-горе!** В повечето случаи проблемът е:
- Липсващ OPENAI_API_KEY secret
- Приложението не е рестартирано след промените
- Network connectivity проблем

### 🆘 Още помощ?

Ако нищо не работи:

1. **Споделете Expo console logs** - копирайте цялата грешка
2. **Проверете Supabase Edge Function logs**:
   - Dashboard → Logs → Edge Functions
   - Филтрирайте по function: transcribe
   - Копирайте грешката (ако има)
3. **Тествайте Edge Functions директно** (вижте `test-edge-functions.md`)

---

## Quick Checklist

Преди да питате за помощ, проверете:

- [ ] URL polyfill е добавен в `app/_layout.tsx` (линия 1)
- [ ] FormData използва URI format, не blob
- [ ] OPENAI_API_KEY е добавен като Supabase secret
- [ ] Expo dev server е рестартиран (`Ctrl+C` → `npm run dev`)
- [ ] Expo Go приложението е напълно затворено и отворено отново
- [ ] Телефонът има активна интернет връзка
- [ ] Edge Functions са Active в Dashboard
- [ ] Console logs показват детайли за грешката

Ако всички са ✅ но все още не работи, споделете:
1. Пълната грешка от Expo console
2. Edge Function logs от Dashboard
3. Телефон модел и OS версия (iOS/Android)
