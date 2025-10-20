const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testAppointmentInsert() {
  try {
    console.log('\n=== TESTING APPOINTMENT INSERT ===\n');

    // First, get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {
      console.error('User error:', userError);
      console.log('\nYou need to be logged in to test this. Please provide admin credentials.');
      return;
    }

    console.log('Current user ID:', user?.id);
    console.log('Current user email:', user?.email);

    // Check if user is admin
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single();

    if (profileError) {
      console.error('Profile error:', profileError);
      return;
    }

    console.log('User role:', profile?.role);
    console.log('User name:', profile?.full_name);

    if (profile?.role !== 'admin') {
      console.log('\n⚠️  User is not an admin. Cannot test admin appointment creation.');
      return;
    }

    // Get a service
    const { data: services, error: serviceError } = await supabase
      .from('services')
      .select('id, name')
      .eq('is_active', true)
      .limit(1);

    if (serviceError || !services || services.length === 0) {
      console.error('Service error:', serviceError);
      console.log('No active services found. Please create a service first.');
      return;
    }

    console.log('\nUsing service:', services[0].name);

    // Create unregistered client
    console.log('\n--- Creating unregistered client ---');
    const { data: newClient, error: clientError } = await supabase
      .from('unregistered_clients')
      .insert({
        full_name: 'Test Client ' + Date.now(),
        phone: '0888123456',
        created_by: user.id,
      })
      .select()
      .single();

    if (clientError) {
      console.error('❌ Client creation error:', JSON.stringify(clientError, null, 2));
      return;
    }

    console.log('✅ Client created:', newClient.id);

    // Try to create appointment
    console.log('\n--- Creating appointment ---');

    const today = new Date();
    const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

    const appointmentData = {
      service_id: services[0].id,
      appointment_date: dateStr,
      start_time: '10:00',
      end_time: '11:00',
      notes: 'Test appointment',
      status: 'confirmed',
      unregistered_client_id: newClient.id,
      client_id: null,
    };

    console.log('Appointment data:', JSON.stringify(appointmentData, null, 2));

    const { data: appointment, error: appointmentError } = await supabase
      .from('appointments')
      .insert(appointmentData)
      .select()
      .single();

    if (appointmentError) {
      console.error('❌ Appointment creation error:', JSON.stringify(appointmentError, null, 2));

      // Clean up the test client
      await supabase
        .from('unregistered_clients')
        .delete()
        .eq('id', newClient.id);

      console.log('\n🧹 Cleaned up test client');
      return;
    }

    console.log('✅ Appointment created successfully!');
    console.log('Appointment ID:', appointment.id);

    // Clean up - delete test appointment and client
    console.log('\n--- Cleaning up test data ---');

    await supabase
      .from('appointments')
      .delete()
      .eq('id', appointment.id);

    await supabase
      .from('unregistered_clients')
      .delete()
      .eq('id', newClient.id);

    console.log('✅ Test data cleaned up');
    console.log('\n=== TEST COMPLETED SUCCESSFULLY ===\n');

  } catch (err) {
    console.error('Exception:', err);
  }
}

testAppointmentInsert();
