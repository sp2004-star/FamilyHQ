const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { sendExpiryReminderEmail } = require('../services/email');

function startReminderScheduler() {
  // Run every day at 9:00 AM
  cron.schedule('0 9 * * *', () => {
    console.log('🔔 Running expiry reminder check...');
    checkExpiries();
  });

  // Also run on startup (after a short delay)
  setTimeout(checkExpiries, 5000);
}

function checkExpiries() {
  const reminderDays = [30, 7, 1];

  reminderDays.forEach(days => {
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + days);
    const dateStr = targetDate.toISOString().split('T')[0];

    // Find documents expiring on this date that haven't had reminders sent
    const docs = db.prepare(`
      SELECT d.*, f.name as family_name, u.email as owner_email, u.name as owner_name
      FROM documents d
      JOIN families f ON f.id = d.family_id
      JOIN users u ON u.id = d.uploaded_by
      WHERE date(d.expiry_date) = ?
        AND NOT EXISTS (
          SELECT 1 FROM reminder_log rl 
          WHERE rl.document_id = d.id AND rl.days_before = ?
        )
    `).all(dateStr, days);

    docs.forEach(doc => {
      // Send in-app notification
      db.prepare(
        'INSERT INTO notifications (id, user_id, family_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(
        uuidv4(), doc.uploaded_by, doc.family_id, 'expiry_reminder',
        `Document expiring in ${days} day${days !== 1 ? 's' : ''}`,
        `"${doc.name}" expires on ${doc.expiry_date}`
      );

      // Send email
      sendExpiryReminderEmail({
        to: doc.owner_email,
        userName: doc.owner_name,
        documentName: doc.name,
        daysUntilExpiry: days,
        familyName: doc.family_name,
      });

      // Log reminder as sent
      db.prepare(
        'INSERT OR IGNORE INTO reminder_log (id, document_id, days_before) VALUES (?, ?, ?)'
      ).run(uuidv4(), doc.id, days);

      console.log(`  📧 Reminder sent for "${doc.name}" (${days} days) to ${doc.owner_email}`);
    });
  });
}

module.exports = { startReminderScheduler };
