const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function checkDuplicates() {
  try {
    // Get all notifications from today
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching notifications:', error);
      return;
    }

    console.log('\n=== Recent Notifications ===\n');

    // Group by type, user_id, and body to find duplicates
    const grouped = {};

    notifications.forEach(notif => {
      const key = `${notif.type}_${notif.user_id}_${notif.body}`;
      if (!grouped[key]) {
        grouped[key] = [];
      }
      grouped[key].push(notif);
    });

    // Find duplicates
    let hasDuplicates = false;
    Object.entries(grouped).forEach(([key, notifs]) => {
      if (notifs.length > 1) {
        hasDuplicates = true;
        console.log(`\n🔴 DUPLICATE FOUND (${notifs.length} times):`);
        console.log(`Type: ${notifs[0].type}`);
        console.log(`Body: ${notifs[0].body}`);
        console.log(`User ID: ${notifs[0].user_id}`);
        notifs.forEach(n => {
          console.log(`  - ID: ${n.id}, Created: ${n.created_at}`);
        });
      }
    });

    if (!hasDuplicates) {
      console.log('✅ No duplicates found!');
    }

    // Check for message-related notifications
    console.log('\n=== Message Notifications ===\n');
    const messageNotifs = notifications.filter(n => n.type === 'new_message');
    console.log(`Total message notifications: ${messageNotifs.length}`);

    messageNotifs.forEach(n => {
      const messageId = n.data?.message_id;
      console.log(`- ${n.title}: ${n.body} (Message ID: ${messageId}, Notif ID: ${n.id})`);
    });

  } catch (err) {
    console.error('Error:', err);
  }
}

checkDuplicates();
