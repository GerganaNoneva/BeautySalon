const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false
    }
  }
);

async function checkTriggers() {
  console.log('Checking triggers on appointment_requests table...\n');

  const { data, error } = await supabase
    .rpc('exec_sql', {
      sql: `
        SELECT
          tgname as trigger_name,
          pg_get_triggerdef(oid) as trigger_definition
        FROM pg_trigger
        WHERE tgrelid = 'appointment_requests'::regclass
        AND tgname NOT LIKE 'RI_%'
        AND tgname NOT LIKE 'pg_%'
        ORDER BY tgname;
      `
    });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${data?.length || 0} custom triggers:\n`);

  if (data && data.length > 0) {
    data.forEach((trigger, index) => {
      console.log(`${index + 1}. ${trigger.trigger_name}`);
      console.log(`   Definition: ${trigger.trigger_definition}`);
      console.log('');
    });
  } else {
    console.log('No custom triggers found.');
  }
}

checkTriggers().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
