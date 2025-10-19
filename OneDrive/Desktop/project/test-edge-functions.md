# Тестване на Edge Functions

## Бърз тест дали Edge Functions работят

### 1. Тест на transcribe функцията

```bash
# Проверете дали endpoint-ът отговаря (трябва да видите 401 или 405)
curl -I https://wbkkchcgnehauypaysen.supabase.co/functions/v1/transcribe
```

**Очакван резултат:**
- HTTP/2 401 = Функцията работи, но изисква authentication ✅
- HTTP/2 404 = Функцията не е deployed ❌
- Connection error = Network проблем ❌

### 2. Тест на parse-reservation функцията

```bash
curl -I https://wbkkchcgnehauypaysen.supabase.co/functions/v1/parse-reservation
```

**Очакван резултат:** Същото като по-горе

### 3. Проверка на Supabase Dashboard

Отворете: https://supabase.com/dashboard/project/wbkkchcgnehauypaysen/functions

**Трябва да видите:**
- ✅ transcribe (Active)
- ✅ parse-reservation (Active)

### 4. Проверка на Secrets

Отворете: https://supabase.com/dashboard/project/wbkkchcgnehauypaysen/settings/vault/secrets

**Трябва да видите:**
- ✅ OPENAI_API_KEY (със скрита стойност)

Ако **НЕ виждате** OPENAI_API_KEY:

1. Кликнете "New secret"
2. Name: `OPENAI_API_KEY`
3. Value: `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`
4. Save

### 5. Проверка на Console Logs (в приложението)

Когато записвате глас и натиснете stop, в Expo console трябва да видите:

```
Uploading audio to transcribe...
Transcription response: { text: "..." }
Transcribed text: петък от три и половина до пет гел лак за мария
Parsing reservation...
Parsed reservation: { customerName: "Мария", service: "Гел лак", ... }
```

Ако виждате **грешки**, потърсете:

- `Network error:` = Проблем с connectivity или CORS
- `OpenAI API key not configured` = Secret не е добавен
- `401` = Authentication проблем
- `500` = Edge Function грешка (проверете logs в Dashboard)

### 6. Проверка на Edge Function Logs

Отворете: https://supabase.com/dashboard/project/wbkkchcgnehauypaysen/logs/edge-functions

Филтрирайте по:
- Function: transcribe
- Recent requests

**Търсете:**
- ✅ 200 OK responses = Работи
- ❌ 500 errors = Има проблем
- ❌ "OpenAI API key not configured" = Secret липсва

### 7. Ръчен тест с curl (Advanced)

Ако искате да тествате директно с curl:

```bash
# 1. Вземете access token от вашата Expo app
# (от console.log или от Supabase Dashboard → Auth → Users)

# 2. Тествайте parse-reservation
curl -X POST https://wbkkchcgnehauypaysen.supabase.co/functions/v1/parse-reservation \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6India2tjaGNnbmVoYXV5cGF5c2VuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyNTUxOTgsImV4cCI6MjA3NTgzMTE5OH0.YSnuni42mjApHKV6ZO8p18xC004NPC0SELrh5p-48oo" \
  -H "Content-Type: application/json" \
  -d '{"text":"петък от три и половина до пет, гел лак, за мария иванова"}'
```

**Очакван резултат:**
```json
{
  "customerName": "Мария Иванова",
  "phone": null,
  "service": "Гел лак",
  "date": "2025-10-17",
  "startTime": "15:30",
  "endTime": "17:00",
  "notes": null
}
```

## Често Срещани Проблеми

### Проблем: "Network request failed"

**Причини:**
1. Интернет връзката е прекъсната
2. Edge Functions са down
3. CORS проблем

**Решение:**
- Проверете интернет връзката
- Проверете Supabase status page
- Проверете CORS headers в Edge Functions

### Проблем: "OpenAI API key not configured"

**Причина:** Secret не е добавен в Supabase

**Решение:**
1. Dashboard → Settings → Vault → Secrets
2. Add: OPENAI_API_KEY
3. Изчакайте 1-2 минути
4. Опитайте отново

### Проблем: 401 Unauthorized

**Причина:** Authentication token е невалиден или изтекъл

**Решение:**
- Logout и login отново в приложението
- Проверете дали имате активна сесия

### Проблем: 500 Internal Server Error

**Причини:**
1. OpenAI API грешка (invalid key, rate limit, etc.)
2. Грешка в Edge Function код
3. OpenAI API е down

**Решение:**
1. Проверете Edge Function logs в Dashboard
2. Проверете OpenAI API status
3. Проверете дали API key-ът е валиден в OpenAI dashboard

## Debugging Checklist

- [ ] Edge Functions са deployed (Dashboard показва Active)
- [ ] OPENAI_API_KEY е добавен като secret
- [ ] Интернет връзката работи
- [ ] Supabase проектът е активен
- [ ] OpenAI API key е валиден (не е expired)
- [ ] OpenAI API има баланс (ако е платен акаунт)
- [ ] Console logs показват правилни API calls
- [ ] Edge Function logs не показват грешки

Ако всички checklist items са ✅ но все още не работи, проверете Expo logs за детайлна информация.
