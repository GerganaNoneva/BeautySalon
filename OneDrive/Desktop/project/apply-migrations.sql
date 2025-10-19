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
