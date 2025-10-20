const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkPolicies() {
  try {
    console.log('\n=== TESTING APPOINTMENTS ACCESS ===\n');

    // Check current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user) {
      console.log('⚠️  Not logged in. Cannot test admin access.');
      console.log('Please log in as admin in the browser and try again.');
      return;
    }

    console.log('Logged in as:', user.email);

    // Check if admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (!profile) {
      console.log('❌ No profile found for user');
      return;
    }

    console.log('User role:', profile.role);
    console.log('User name:', profile.full_name);

    if (profile.role !== 'admin') {
      console.log('⚠️  User is not admin. Testing client access only...');
    }

    // Try to read appointments
    console.log('\n--- Testing SELECT permission ---');
    const { data: appointments, error: selectError } = await supabase
      .from('appointments')
      .select('*')
      .limit(1);

    if (selectError) {
      console.log('❌ SELECT failed:', selectError.message);
      console.log('Code:', selectError.code);
    } else {
      console.log('✅ SELECT works! Found', appointments.length, 'appointments (limited to 1)');
    }

    // If admin, try to insert
    if (profile.role === 'admin') {
      console.log('\n--- Testing INSERT permission (admin) ---');

      // Get a service
      const { data: services } = await supabase
        .from('services')
        .select('id')
        .eq('is_active', true)
        .limit(1);

      if (!services || services.length === 0) {
        console.log('⚠️  No active services found. Cannot test INSERT.');
        console.log('Please create at least one active service first.');
        return;
      }

      // Create test unregistered client
      const { data: testClient, error: clientError } = await supabase
        .from('unregistered_clients')
        .insert({
          full_name: 'Test Client ' + Date.now(),
          phone: '0888999888',
          created_by: user.id,
        })
        .select()
        .single();

      if (clientError) {
        console.log('❌ Creating test client failed:', clientError.message);
        return;
      }

      console.log('✅ Test client created:', testClient.id);

      // Try to insert appointment
      const today = new Date();
      const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

      const testAppointment = {
        service_id: services[0].id,
        appointment_date: dateStr,
        start_time: '15:00',
        end_time: '16:00',
        status: 'confirmed',
        unregistered_client_id: testClient.id,
        notes: 'Test appointment',
      };

      console.log('Attempting to insert:', testAppointment);

      const { data: appointment, error: insertError } = await supabase
        .from('appointments')
        .insert(testAppointment)
        .select()
        .single();

      if (insertError) {
        console.log('❌ INSERT failed:', insertError.message);
        console.log('Code:', insertError.code);
        console.log('Details:', JSON.stringify(insertError, null, 2));

        // Clean up test client
        await supabase
          .from('unregistered_clients')
          .delete()
          .eq('id', testClient.id);

        console.log('🧹 Cleaned up test client');
      } else {
        console.log('✅ INSERT works! Appointment created:', appointment.id);

        // Clean up
        console.log('\n--- Cleaning up test data ---');
        await supabase
          .from('appointments')
          .delete()
          .eq('id', appointment.id);

        await supabase
          .from('unregistered_clients')
          .delete()
          .eq('id', testClient.id);

        console.log('✅ Test data cleaned up');
      }
    }

    console.log('\n=== TEST COMPLETED ===\n');

  } catch (err) {
    console.error('Exception:', err);
  }
}

checkPolicies();
