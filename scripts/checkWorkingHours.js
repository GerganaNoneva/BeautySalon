const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkWorkingHours() {
  console.log('🔍 Checking working hours configuration...\n');

  const { data, error } = await supabase
    .from('salon_info')
    .select('working_hours_json')
    .maybeSingle();

  if (error) {
    console.error('❌ Error:', error);
    return;
  }

  if (!data) {
    console.log('⚠️  No salon_info record found');
    return;
  }

  if (!data.working_hours_json) {
    console.log('⚠️  working_hours_json is NULL or empty');
    return;
  }

  console.log('✅ Working hours found:\n');
  console.log(JSON.stringify(data.working_hours_json, null, 2));
}

checkWorkingHours();
