const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkAppointments() {
  console.log('Checking appointments for 2025-10-28...\n');

  const { data, error } = await supabase
    .from('appointments')
    .select('id, appointment_date, start_time, end_time, status, service_id, user_id')
    .eq('appointment_date', '2025-10-28')
    .order('start_time');

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data.length} appointments:\n`);
  data.forEach(apt => {
    console.log(`ID: ${apt.id}`);
    console.log(`Date: ${apt.appointment_date}`);
    console.log(`Time: ${apt.start_time} - ${apt.end_time}`);
    console.log(`Status: ${apt.status}`);
    console.log(`Service ID: ${apt.service_id}`);
    console.log(`User ID: ${apt.user_id}`);
    console.log('---');
  });
}

checkAppointments().then(() => process.exit(0));
