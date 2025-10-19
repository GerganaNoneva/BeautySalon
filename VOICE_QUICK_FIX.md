# Voice Reservation - Quick Fix Guide

## 🚨 Текуща Грешка: "Грешка при парсиране (400)"

### Какво означава:
- ✅ Audio recording работи
- ✅ Network connection работи
- ✅ Audio transcription (Whisper) работи
- ❌ **OpenAI API Key има проблем**

### 🔧 Бърза Проверка:

Тествайте вашия OpenAI API key:

```bash
./test-openai-key.sh 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
```

### 🎯 Най-Вероятни Причини:

#### 1. API Key е невалиден/изтекъл
**Решение:** Генерирайте нов API key
1. Отворете: https://platform.openai.com/api-keys
2. Create new secret key
3. Copy key-а
4. Добавете в Supabase:
```bash
supabase secrets set OPENAI_API_KEY="новият-ви-key" --project-ref wbkkchcgnehauypaysen
```

#### 2. Липсва billing/quota
**Решение:** Добавете payment method
1. Отворете: https://platform.openai.com/account/billing
2. Add payment method
3. Add credits (minimum $5-10)

#### 3. API Key няма достъp до gpt-4o-mini
**Решение:** Проверете project settings
1. OpenAI Dashboard → Settings
2. Убедете се че проектът има достъп до GPT-4o модели
3. Free tier keys нямат достъп - upgrade to paid plan

---

## 📋 Пълен Checklist:

### Преди Всичко:
- [ ] Рестартирали ли сте Expo dev server? (`Ctrl+C` → `npm run dev`)
- [ ] Рестартирали ли сте Expo Go на телефона? (напълно затворено и отворено отново)
- [ ] Има ли телефонът интернет връзка?

### OpenAI API Key Setup:
- [ ] Имате ли валиден OpenAI акаунт?
- [ ] Добавили ли сте payment method? (billing)
- [ ] Генерирахте ли нов API key от correct project?
- [ ] Копирахте ли key-а ТОЧНО (без spaces/newlines)?
- [ ] Добавихте ли key-а в Supabase secrets?

### Тест:
- [ ] Тествали ли сте API key-а с `test-openai-key.sh`?
- [ ] Показва ли скриптът "✅ ALL TESTS PASSED"?

---

## 🧪 Debugging Стъпки:

### 1. Тествайте API Key-а локално

```bash
# Manual test
curl https://api.openai.com/v1/models \
  -H "Authorization: Bearer YOUR_KEY"

# Трябва да видите JSON с модели
# Ако видите error → key е невалиден
```

### 2. Проверете дали key-ът е добавен в Supabase

```bash
supabase secrets list --project-ref wbkkchcgnehauypaysen

# Трябва да видите:
# NAME                 VALUE (REDACTED)
# OPENAI_API_KEY       sk-proj-s...iaQA
```

### 3. Проверете Edge Function logs

1. Отворете: https://supabase.com/dashboard/project/wbkkchcgnehauypaysen/logs/edge-functions
2. Filter по: `parse-reservation`
3. Потърсете последната грешка
4. Ако видите "OpenAI API error:" → копирайте детайлите

### 4. Тествайте Edge Function директно

```bash
# Get your session token
# (от Supabase Dashboard → Authentication → Users → Copy JWT)

curl -X POST \
  https://wbkkchcgnehauypaysen.supabase.co/functions/v1/parse-reservation \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"text":"петък от три до пет гел лак за мария"}'

# Трябва да видите parsed reservation JSON
# Ако видите error → проблемът е в Edge Function-а
```

---

## 💡 Често Срещани Грешки:

### "Incorrect API key provided"
**Причина:** Key-ът е невалиден или не е от correct organization
**Решение:** Генерирайте нов key от правилния проект

### "You exceeded your current quota"
**Причина:** Billing account няма credits или е expired
**Решение:** Добавете payment method и credits

### "The model gpt-4o-mini does not exist"
**Причина:** API key няма достъп до този модел
**Решение:** Upgrade account или използвайте gpt-3.5-turbo

### "Rate limit reached"
**Причина:** Твърде много requests за кратко време
**Решение:** Изчакайте 1-2 минути

---

## 🎉 Когато Проблемът е Решен:

Ще видите:
1. "Обработка..." за 2-5 секунди
2. Reservation modal се отваря
3. **Полетата са автоматично попълнени!**
   - Customer Name: "Мария"
   - Service: "Гел лак"
   - Date: следващия петък
   - Time: 15:00-17:00

---

## 📞 Още Помощ?

Ако нищо не работи:

1. **Споделете console output:**
   - От Expo terminal
   - От Expo Go app (shake device → View logs)

2. **Споделете Edge Function logs:**
   - Dashboard → Logs → Edge Functions → parse-reservation

3. **Споделете test-openai-key.sh output:**
   ```bash
   ./test-openai-key.sh YOUR_KEY > openai-test-output.txt
   ```

4. **Проверете пълния troubleshooting guide:**
   - `VOICE_TROUBLESHOOTING.md`
