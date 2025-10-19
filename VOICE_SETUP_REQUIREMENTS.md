# Настройка на Гласова Резервация

## ⚠️ Важно: Production Deployment Requirements

Гласовата резервация изисква **реална Supabase среда** с Edge Functions. Тази функционалност **НЕ РАБОТИ** в:
- Bolt.new preview
- Local development без реален Supabase проект
- Expo Go (изисква development build)

## Стъпки за Активиране

### 1. Deploy на Supabase Project

Създайте реален Supabase проект на [supabase.com](https://supabase.com):

```bash
# Инсталирайте Supabase CLI
npm install -g supabase

# Login
supabase login

# Link към вашия проект
supabase link --project-ref YOUR_PROJECT_REF

# Deploy Edge Functions
supabase functions deploy transcribe
supabase functions deploy parse-reservation
```

### 2. Конфигурирайте OpenAI API Key

В Supabase Dashboard → Settings → Edge Functions → Secrets:

```bash
# Добавете secret
OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY
```

Или чрез CLI:

```bash
supabase secrets set OPENAI_API_KEY=sk-proj-YOUR_OPENAI_KEY
```

### 3. Обновете .env файла

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 4. Създайте Development Build

Expo Go НЕ поддържа `expo-av` recording. Трябва development build:

```bash
# Инсталирайте EAS CLI
npm install -g eas-cli

# Login
eas login

# Configure build
eas build:configure

# Build за Android
eas build --platform android --profile development

# Build за iOS (нужен е Mac)
eas build --platform ios --profile development
```

### 5. Тествайте на Реално Устройство

След като build-ът приключи:

1. Изтеглете `.apk` (Android) или `.ipa` (iOS)
2. Инсталирайте на устройството
3. Отворете приложението
4. Отидете в График (админ)
5. Натиснете иконата микрофон
6. Разрешете достъп до микрофона
7. Запишете резервация

## Алтернативно Решение (За Development)

Ако не можете да deploy-нете на Supabase, можете да използвате директна интеграция с OpenAI от клиента:

### Стъпки:

1. **Промяна на VoiceRecorder.tsx** - Директно извикване на OpenAI API
2. **Добавяне на axios** - `npm install axios`
3. **Конфигуриране на API key в .env**

⚠️ **ВАЖНО**: Това е САМО за development! НЕ използвайте в production - API ключът ще бъде видим!

## Проверка на Статус

### Edge Functions Deploy Status

```bash
supabase functions list
```

Трябва да видите:
- `transcribe`
- `parse-reservation`

### Test Edge Function

```bash
# Test transcribe
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/transcribe \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -F "audio=@test.m4a"

# Test parse-reservation
curl -X POST https://YOUR_PROJECT.supabase.co/functions/v1/parse-reservation \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Петък от три и половина до пет, гел лак, за Мария"}'
```

## Troubleshooting

### "OpenAI API key not configured"

Edge Function няма достъп до secret. Проверете:

```bash
supabase secrets list
```

Трябва да видите `OPENAI_API_KEY`.

### "Failed to process audio"

- Проверете интернет връзката
- Проверете дали Edge Functions са deployed
- Проверете дали API key-ът е валиден
- Проверете console logs в Supabase Dashboard

### "No active session"

Потребителят не е логнат. Влезте отново в приложението.

### Recording не стартира

- Проверете дали имате разрешение за микрофон
- Проверете дали сте в development build (не Expo Go)
- Проверете дали устройството има микрофон

## Costs Estimate

### OpenAI API Costs

- **Whisper-1 (transcription)**: ~$0.006 / минута
- **GPT-4o-mini (parsing)**: ~$0.00015 / 1000 токена

Примерна цена за 1 резервация: **~$0.01** (1 минута запис)

### Supabase Costs

- Edge Functions: Включени в Free tier (500K requests/месец)
- Database: Free tier за малки проекти

## Support

За въпроси относно настройката:
1. Проверете Supabase документацията: https://supabase.com/docs/guides/functions
2. OpenAI API документация: https://platform.openai.com/docs/
3. Expo Development Builds: https://docs.expo.dev/develop/development-builds/
