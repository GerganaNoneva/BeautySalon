# Настройка на Google и Facebook OAuth в Supabase

За да работи вход с Google и Facebook, трябва да конфигурирате OAuth providers в Supabase Dashboard.

## 📋 Предварителни изисквания

1. Достъп до Supabase Dashboard
2. Google Cloud Console акаунт (за Google OAuth)
3. Facebook Developers акаунт (за Facebook OAuth)

---

## 🔵 Google OAuth Настройка

### Стъпка 1: Създаване на Google OAuth App

1. Отидете на [Google Cloud Console](https://console.cloud.google.com/)
2. Създайте нов проект или изберете съществуващ
3. В менюто отидете на **APIs & Services** → **Credentials**
4. Натиснете **Create Credentials** → **OAuth client ID**
5. Изберете **Web application**
6. Въведете име: `URBAN Beauty`

### Стъпка 2: Конфигуриране на Redirect URLs

В **Authorized redirect URIs** добавете:

```
https://wbkkchcgnehauypaysen.supabase.co/auth/v1/callback
```

### Стъпка 3: Копирайте Client ID и Client Secret

След създаване ще получите:
- **Client ID**: `your-client-id.apps.googleusercontent.com`
- **Client Secret**: `your-client-secret`

### Стъпка 4: Конфигуриране в Supabase

1. Отидете на Supabase Dashboard
2. Изберете вашия проект
3. Отидете на **Authentication** → **Providers**
4. Намерете **Google** и го активирайте
5. Въведете:
   - Client ID (from Google)
   - Client Secret (from Google)
6. Натиснете **Save**

---

## 🔴 Facebook OAuth Настройка

### Стъпка 1: Създаване на Facebook App

1. Отидете на [Facebook Developers](https://developers.facebook.com/)
2. Натиснете **My Apps** → **Create App**
3. Изберете **Consumer** като тип
4. Въведете име: `URBAN Beauty`
5. Въведете имейл за контакт

### Стъпка 2: Добавяне на Facebook Login

1. В dashboard на вашето приложение
2. Натиснете **Add Product**
3. Изберете **Facebook Login** → **Set Up**
4. Изберете **Web**

### Стъпка 3: Конфигуриране на Redirect URLs

В **Facebook Login** → **Settings**:

**Valid OAuth Redirect URIs**:
```
https://wbkkchcgnehauypaysen.supabase.co/auth/v1/callback
```

### Стъпка 4: Копирайте App ID и App Secret

1. Отидете на **Settings** → **Basic**
2. Копирайте:
   - **App ID**: `your-app-id`
   - **App Secret**: (натиснете **Show** за да видите)

### Стъпка 5: Конфигуриране в Supabase

1. Отидете на Supabase Dashboard
2. Изберете вашия проект
3. Отидете на **Authentication** → **Providers**
4. Намерете **Facebook** и го активирайте
5. Въведете:
   - Client ID (Facebook App ID)
   - Client Secret (Facebook App Secret)
6. Натиснете **Save**

---

## ✅ Тестване

След настройка:

1. Стартирайте приложението: `npm run dev`
2. Отидете на екрана за вход
3. Натиснете "Продължи с Google" или "Продължи с Facebook"
4. Влезте с вашия акаунт
5. Приемете разрешенията
6. Трябва да бъдете автоматично пренасочени обратно към приложението

## 🔐 Важни бележки

### За администраторски достъп:

Администраторска роля се дава автоматично само на имейл: **gergananoneva@gmail.com**

Ако влезете с този имейл през Google/Facebook OAuth, ще получите администраторски достъп автоматично.

### За тестване в локална среда:

За локално тестване с localhost, трябва също да добавите в redirect URLs:

**Google:**
```
http://localhost:8081/auth/v1/callback
```

**Facebook:**
```
http://localhost:8081/auth/v1/callback
```

### Production Redirect URLs:

Когато качите приложението на production домейн, не забравяйте да добавите production redirect URLs:

```
https://your-domain.com/auth/v1/callback
```

## 🐛 Troubleshooting

### Грешка: "redirect_uri_mismatch"
- Проверете дали redirect URI е правилно въведен в Google/Facebook console
- Уверете се, че URL-ът е точно същият (без trailing slash)

### Потребителят не се създава автоматично
- Проверете дали имате правилни RLS policies в таблицата `profiles`
- Проверете логовете в Supabase Dashboard → Authentication → Logs

### OAuth не работи на mobile
- OAuth работи най-добре на web платформа
- За mobile е необходимо допълнително конфигуриране с deep linking

---

## 📞 Поддръжка

За допълнителна помощ:
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Google OAuth Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Facebook Login Documentation](https://developers.facebook.com/docs/facebook-login)
