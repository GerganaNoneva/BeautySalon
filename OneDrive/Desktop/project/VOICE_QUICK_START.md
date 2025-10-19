# Гласова Резервация - Бърз Старт

## ⚠️ ВАЖНО: Текущо Състояние

Гласовата резервация е **напълно имплементирана** но изисква:

1. **Реален Supabase проект** с deployed Edge Functions
2. **OpenAI API Key** конфигуриран като Supabase secret
3. **Мобилно устройство** (iOS/Android) с development build

## Защо Не Работи в Bolt.new?

Текущата среда е **симулирана** и няма:
- Реални Edge Functions (transcribe, parse-reservation)
- Конфигурирани secrets (OPENAI_API_KEY)
- Мобилен контекст за audio recording

## Какво Е Готово?

✅ **Frontend**: Пълен UI с VoiceRecorder компонент
✅ **Backend**: Edge Functions код (transcribe, parse-reservation)
✅ **Integration**: Автоматично попълване на резервация форма
✅ **Validation**: Обработка на грешки и валидация
✅ **Documentation**: Пълни инструкции

## Следващи Стъпки

### За Production Deployment:

1. **Прочетете**: `VOICE_SETUP_REQUIREMENTS.md`
2. **Deploy**: Supabase Edge Functions
3. **Configure**: OpenAI API Key
4. **Build**: Development build за iOS/Android
5. **Test**: На реално устройство

### За Локално Тестване (Mock Mode):

Ако искате да тествате потока БЕЗ реални Edge Functions, можете да добавите mock режим:

```typescript
// В VoiceRecorder.tsx - добавете тази функция за testing

const mockProcessAudio = async () => {
  // Симулиран response
  return {
    text: "Петък от три и половина до пет, гел лак, за Мария Иванова",
    parsed: {
      customerName: "Мария Иванова",
      phone: null,
      service: "Гел лак",
      date: "2025-10-17", // следващ петък
      startTime: "15:30",
      endTime: "17:00",
      notes: null
    }
  };
};
```

## Съобщения за Грешки

### "Недостъпно на Web"
- Web платформата НЕ поддържа audio recording
- Използвайте iOS/Android устройство

### "Edge Function грешка"
- Edge Functions не са deployed или
- OPENAI_API_KEY не е конфигуриран
- Вижте setup инструкциите

### "Моля, влезте отново"
- Session е изтекла
- Logout и Login отново

## Демо Видео

За да видите как работи функционалността:

1. Отидете в График (Admin панел)
2. Над полето за дата има икона микрофон
3. Натискате → започва запис (червена анимация)
4. Говорите: "Петък от три и половина до пет, гел лак, за Мария"
5. Натискате отново → спира и обработва
6. Модалът за резервация се отваря автоматично с попълнени полета

## Support & Questions

- **Setup инструкции**: Вижте `VOICE_SETUP_REQUIREMENTS.md`
- **API документация**: Вижте `VOICE_RESERVATION_GUIDE.md`
- **Edge Functions код**: `supabase/functions/transcribe/` и `parse-reservation/`

## Costs Warning

⚠️ OpenAI API разходи:
- ~$0.006 на минута запис (Whisper)
- ~$0.0001 за parsing (GPT-4o-mini)
- **Общо: ~$0.01 на резервация**

Настройте billing limits в OpenAI dashboard!
