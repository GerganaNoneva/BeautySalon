const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

async function testTriggers() {
  try {
    console.log('🔍 Checking database triggers...\n');

    // Get list of triggers on messages table
    const { data: triggers, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT
          tgname as trigger_name,
          proname as function_name,
          tgenabled as enabled
        FROM pg_trigger t
        JOIN pg_proc p ON t.tgfoid = p.oid
        WHERE tgrelid = 'messages'::regclass
        AND tgname NOT LIKE 'RI_%'
        ORDER BY tgname;
      `
    });

    if (error) {
      console.log('⚠️  Cannot query triggers directly. Checking recent notifications instead...\n');

      // Alternative: Check recent message notifications
      const { data: messages, error: msgError } = await supabase
        .from('messages')
        .select('id, content, sender_id, conversation_id, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      if (msgError) {
        console.error('Error fetching messages:', msgError);
        return;
      }

      console.log(`📨 Recent messages: ${messages?.length || 0}\n`);

      for (const msg of messages || []) {
        console.log(`Message ID: ${msg.id}`);
        console.log(`Content: ${msg.content?.substring(0, 50)}...`);
        console.log(`Created: ${msg.created_at}`);

        // Check notifications for this message
        const { data: notifs, error: notifError } = await supabase
          .from('notifications')
          .select('*')
          .eq('type', 'new_message')
          .filter('data->>message_id', 'eq', msg.id);

        if (!notifError && notifs) {
          console.log(`  ➜ Notifications created: ${notifs.length}`);
          notifs.forEach((n, i) => {
            console.log(`     ${i + 1}. ID: ${n.id}, User: ${n.user_id}, Created: ${n.created_at}`);
          });
        }
        console.log('');
      }

      // Check for duplicate notifications
      console.log('\n🔍 Checking for duplicate notifications...\n');

      const { data: allNotifs, error: allNotifsError } = await supabase
        .from('notifications')
        .select('*')
        .eq('type', 'new_message')
        .order('created_at', { ascending: false })
        .limit(20);

      if (!allNotifsError && allNotifs) {
        const grouped = {};
        allNotifs.forEach(n => {
          const msgId = n.data?.message_id;
          if (msgId) {
            if (!grouped[msgId]) {
              grouped[msgId] = [];
            }
            grouped[msgId].push(n);
          }
        });

        let foundDuplicates = false;
        Object.entries(grouped).forEach(([msgId, notifs]) => {
          if (notifs.length > 1) {
            foundDuplicates = true;
            console.log(`🔴 DUPLICATE: Message ${msgId} has ${notifs.length} notifications:`);
            notifs.forEach(n => {
              console.log(`   - Notification ID: ${n.id}, Created: ${n.created_at}`);
            });
          }
        });

        if (!foundDuplicates) {
          console.log('✅ No duplicate notifications found for recent messages!');
        }
      }

    } else {
      console.log('✅ Triggers found:');
      console.log(triggers);
    }

    // Also check notification triggers
    console.log('\n🔍 Checking notification table triggers...\n');

    const { data: recentNotifs, error: recentNotifsError } = await supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (!recentNotifsError && recentNotifs) {
      console.log(`Total recent notifications: ${recentNotifs.length}\n`);

      recentNotifs.forEach(n => {
        console.log(`- ${n.type}: ${n.title}`);
        console.log(`  Body: ${n.body?.substring(0, 60)}...`);
        console.log(`  Created: ${n.created_at}`);
        console.log(`  User: ${n.user_id}\n`);
      });
    }

  } catch (err) {
    console.error('Error:', err);
  }
}

testTriggers();
