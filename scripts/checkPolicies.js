const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPolicies() {
  try {
    console.log('\n=== CHECKING DATABASE SETUP ===\n');

    // Check if is_admin() function exists
    const { data: functions, error: funcError } = await supabase
      .rpc('is_admin')
      .then(() => ({ data: true, error: null }))
      .catch(err => ({ data: null, error: err }));

    if (funcError) {
      console.log('⚠️  is_admin() function test failed:', funcError.message);
      console.log('This might be expected if not logged in.');
    } else {
      console.log('✅ is_admin() function exists and is callable');
    }

    // Check tables exist
    const tables = ['appointments', 'unregistered_clients', 'services', 'profiles'];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .select('id')
        .limit(1);

      if (error) {
        console.log(`❌ Table "${table}":`, error.message);
      } else {
        console.log(`✅ Table "${table}" is accessible`);
      }
    }

    // Count records
    console.log('\n--- Record Counts ---');

    const { count: appointmentCount } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });

    const { count: serviceCount } = await supabase
      .from('services')
      .select('*', { count: 'exact', head: true });

    const { count: clientCount } = await supabase
      .from('unregistered_clients')
      .select('*', { count: 'exact', head: true });

    console.log(`Appointments: ${appointmentCount || 0}`);
    console.log(`Services: ${serviceCount || 0}`);
    console.log(`Unregistered clients: ${clientCount || 0}`);

    // Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      console.log('\n⚠️  No user logged in');
      console.log('To test appointment creation, you need to be logged in as admin.');
    } else {
      console.log('\n--- Current User ---');
      console.log('User ID:', user.id);
      console.log('Email:', user.email);

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, full_name')
        .eq('id', user.id)
        .maybeSingle();

      if (profile) {
        console.log('Name:', profile.full_name);
        console.log('Role:', profile.role);
        console.log(`Is Admin: ${profile.role === 'admin' ? '✅ YES' : '❌ NO'}`);
      }
    }

    console.log('\n=== CHECK COMPLETED ===\n');

  } catch (err) {
    console.error('Exception:', err);
  }
}

checkPolicies();
