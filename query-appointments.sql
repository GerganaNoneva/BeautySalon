SELECT
  a.id,
  TO_CHAR(a.appointment_date, 'DD.MM.YYYY') as date_formatted,
  a.appointment_date,
  a.start_time,
  a.end_time,
  a.status,
  a.notes,
  a.client_message,
  a.admin_notes,
  COALESCE(p.full_name, uc.full_name, 'Без име') as client_name,
  COALESCE(p.phone, uc.phone, 'Без телефон') as client_phone,
  COALESCE(p.email, uc.email, 'Без имейл') as client_email,
  CASE
    WHEN a.client_id IS NOT NULL THEN 'Регистриран'
    ELSE 'Нерегистриран'
  END as client_type,
  s.name as service_name,
  s.price as service_price,
  s.duration_minutes,
  TO_CHAR(a.created_at, 'DD.MM.YYYY HH24:MI') as created_formatted
FROM appointments a
LEFT JOIN profiles p ON a.client_id = p.id
LEFT JOIN unregistered_clients uc ON a.unregistered_client_id = uc.id
LEFT JOIN services s ON a.service_id = s.id
ORDER BY a.appointment_date ASC, a.start_time ASC;
