# СПЕШНО: Приложете миграциите СЕГА

## Проблемът
RLS политиките за `unregistered_clients` таблицата не са правилни и затова не можете да създавате резервации с нови клиенти.

## Решението (3 минути)

### Стъпка 1: Отворете Supabase Dashboard
1. Отидете на: https://supabase.com/dashboard
2. Влезте в проекта си: **wbkkchcgnehauypaysen**

### Стъпка 2: Отворете SQL Editor
1. От лявото меню изберете **"SQL Editor"** (иконка с SQL)
2. Кликнете на бутона **"New query"** (горе вдясно)

### Стъпка 3: Копирайте SQL кода
1. Отворете файла `apply-migrations.sql` от проекта
2. **КОПИРАЙТЕ ЦЕЛИЯ SQL КОД** (47 реда)

### Стъпка 4: Изпълнете SQL
1. **ПОСТАВЕТЕ** кода в SQL Editor
2. Кликнете на бутона **"Run"** (или Ctrl+Enter)
3. Трябва да видите: ✅ **"Success. No rows returned"**

### Стъпка 5: Тествайте
1. Опреснете приложението (Hard refresh: Ctrl+Shift+R)
2. Опитайте да създадете резервация с нов клиент
3. Трябва да работи! ✅

---

## SQL код за копиране:

```sql
-- Migration 1: Fix is_admin() function to read from profiles.role
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role text;
BEGIN
  SELECT role INTO user_role
  FROM profiles
  WHERE id = auth.uid();

  RETURN COALESCE(user_role = 'admin', false);
END;
$$;

-- Migration 2: Fix unregistered_clients RLS policies

-- Drop old policies
DROP POLICY IF EXISTS "Admins can view all unregistered clients" ON unregistered_clients;
DROP POLICY IF EXISTS "Admins can create unregistered clients" ON unregistered_clients;
DROP POLICY IF EXISTS "Admins can update unregistered clients" ON unregistered_clients;
DROP POLICY IF EXISTS "Admins can delete unregistered clients" ON unregistered_clients;

-- Create new policies using is_admin() function
CREATE POLICY "Admins can view all unregistered clients"
  ON unregistered_clients FOR SELECT
  TO authenticated
  USING (is_admin());

CREATE POLICY "Admins can create unregistered clients"
  ON unregistered_clients FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

CREATE POLICY "Admins can update unregistered clients"
  ON unregistered_clients FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admins can delete unregistered clients"
  ON unregistered_clients FOR DELETE
  TO authenticated
  USING (is_admin());
```

---

## Какво прави този SQL:
1. ✅ Поправя `is_admin()` функцията да чете от `profiles.role` колоната
2. ✅ Създава правилни RLS политики за `unregistered_clients` таблицата
3. ✅ След това ще можете да създавате резервации с нови клиенти само по име

## Ако има грешка:
Копирайте цялата грешка и ми я изпратете.
