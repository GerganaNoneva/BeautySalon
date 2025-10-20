const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testAdminAccess() {
  try {
    console.log('\n=== TESTING ADMIN ACCESS TO APPOINTMENTS ===\n');

    // Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user) {
      console.log('❌ Not logged in!');
      console.log('\nYou need to log in as admin in the browser first.');
      console.log('Then run this script again.');
      return;
    }

    console.log('✅ Logged in as:', user.email);

    // Check profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.log('❌ Profile error:', profileError.message);
      return;
    }

    console.log('Profile role:', profile.role);
    console.log('Profile name:', profile.full_name);

    if (profile.role !== 'admin') {
      console.log('\n⚠️  You are not an admin!');
      return;
    }

    console.log('\n--- Testing appointments SELECT ---\n');

    // Try to select all appointments
    const { data: appointments, error: selectError } = await supabase
      .from('appointments')
      .select(`
        id,
        appointment_date,
        start_time,
        end_time,
        client_id,
        unregistered_client_id,
        status
      `)
      .order('appointment_date', { ascending: false })
      .order('start_time', { ascending: false });

    if (selectError) {
      console.log('❌ SELECT failed!');
      console.log('Error:', selectError.message);
      console.log('Code:', selectError.code);
      console.log('\nThis means the RLS policy is blocking access!');
      console.log('The is_admin() function might not be working correctly.');
      return;
    }

    console.log(`✅ SELECT works! Found ${appointments.length} appointments\n`);

    if (appointments.length === 0) {
      console.log('No appointments in database.');
      return;
    }

    // Show breakdown
    const withClientId = appointments.filter(a => a.client_id !== null);
    const withUnregisteredClientId = appointments.filter(a => a.unregistered_client_id !== null);

    console.log('Breakdown:');
    console.log(`- Registered clients: ${withClientId.length}`);
    console.log(`- Unregistered clients: ${withUnregisteredClientId.length}`);
    console.log('\nFirst few appointments:');

    appointments.slice(0, 5).forEach((apt, i) => {
      console.log(`${i + 1}. Date: ${apt.appointment_date}, Time: ${apt.start_time}-${apt.end_time}, Type: ${apt.client_id ? 'Registered' : 'Unregistered'}`);
    });

    console.log('\n=== TEST COMPLETED ===\n');

  } catch (err) {
    console.error('Exception:', err);
  }
}

testAdminAccess();
