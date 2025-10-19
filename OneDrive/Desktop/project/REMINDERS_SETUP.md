# Настройка на автоматични напомняния за резервации

## Какво прави системата?

Системата автоматично изпраща уведомления на регистрираните клиенти:
- **24 часа преди резервацията** - напомняне за утрешната резервация
- **1 час преди резервацията** - напомняне за предстоящата резервация

## Как работи?

1. **Database функции** (вече създадени):
   - `send_appointment_reminders_24h()` - изпраща 24ч напомняния
   - `send_appointment_reminders_1h()` - изпраща 1ч напомняния

2. **Edge Function** (вече създадена):
   - `send-appointment-reminders` - извиква database функциите

## Настройка на планирането

### Опция 1: Използване на външен cron сървис (препоръчително)

Използвайте безплатен cron сървис като [cron-job.org](https://cron-job.org) или [EasyCron](https://www.easycron.com):

1. **За 24-часово напомняне** (всеки ден в 20:00):
   ```
   URL: https://ваш-supabase-url.supabase.co/functions/v1/send-appointment-reminders?type=24h
   Метод: GET
   Headers:
     Authorization: Bearer ВАШ_SUPABASE_ANON_KEY
   Планиране: 0 20 * * * (всеки ден в 20:00)
   ```

2. **За 1-часово напомняне** (всеки час):
   ```
   URL: https://ваш-supabase-url.supabase.co/functions/v1/send-appointment-reminders?type=1h
   Метод: GET
   Headers:
     Authorization: Bearer ВАШ_SUPABASE_ANON_KEY
   Планиране: 0 * * * * (всеки час)
   ```

### Опция 2: Използване на Supabase pg_cron (изисква Enterprise план)

Ако имате Supabase Enterprise план, можете да използвате pg_cron:

```sql
-- 24-часово напомняне - всеки ден в 20:00
SELECT cron.schedule(
  'send-24h-reminders',
  '0 20 * * *',
  $$SELECT send_appointment_reminders_24h()$$
);

-- 1-часово напомняне - всеки час
SELECT cron.schedule(
  'send-1h-reminders',
  '0 * * * *',
  $$SELECT send_appointment_reminders_1h()$$
);
```

### Опция 3: Ръчно тестване

Можете да тествате функциите ръчно:

```bash
# Тест 24ч напомняния
curl -X GET "https://ваш-supabase-url.supabase.co/functions/v1/send-appointment-reminders?type=24h" \
  -H "Authorization: Bearer ВАШ_SUPABASE_ANON_KEY"

# Тест 1ч напомняния
curl -X GET "https://ваш-supabase-url.supabase.co/functions/v1/send-appointment-reminders?type=1h" \
  -H "Authorization: Bearer ВАШ_SUPABASE_ANON_KEY"
```

## Как да намерите вашите credentials?

1. **SUPABASE_URL**:
   - Отворете вашия проект в Supabase Dashboard
   - Settings → API → Project URL

2. **SUPABASE_ANON_KEY**:
   - Settings → API → Project API keys → anon/public key

## Важни бележки

- Уведомленията се изпращат **само на регистрирани клиенти** (не на unregistered_clients)
- Уведомленията се изпращат **само за потвърдени резервации** (status = 'confirmed')
- За 1-часовото напомняне, функцията проверява резервации в рамките на 55-65 минути
- Push уведомленията се изпращат автоматично чрез push notification trigger

## Мониторинг

Можете да проверите дали уведомленията се изпращат:

```sql
-- Проверка на изпратени напомняния
SELECT *
FROM notifications
WHERE type = 'appointment_reminder'
ORDER BY created_at DESC
LIMIT 10;

-- Проверка на предстоящи резервации за утре
SELECT a.*, p.full_name, s.name as service_name
FROM appointments a
LEFT JOIN profiles p ON a.client_id = p.id
LEFT JOIN services s ON a.service_id = s.id
WHERE a.appointment_date = CURRENT_DATE + INTERVAL '1 day'
  AND a.status = 'confirmed'
  AND a.client_id IS NOT NULL;
```

## Troubleshooting

Ако уведомленията не се изпращат:

1. Проверете дали Edge функцията е deploy-ната
2. Проверете дали cron job-овете работят
3. Проверете database логовете за грешки
4. Проверете дали клиентите имат `user_id` в profiles таблицата
5. Проверете дали push token-ите са валидни
