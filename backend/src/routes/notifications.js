const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get notifications for current user
router.get('/', authMiddleware, async (req, res) => {
  const { familyId, unreadOnly } = req.query;

  let query = 'SELECT * FROM notifications WHERE user_id = ?';
  const params = [req.user.id];

  if (familyId) {
    query += ' AND family_id = ?';
    params.push(familyId);
  }

  if (unreadOnly === 'true') {
    query += ' AND read = 0';
  }

  query += ' ORDER BY created_at DESC LIMIT 50';

  const notifications = await db.all(query, params);
  const unreadCount = await db.get('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = 0', [req.user.id]);

  res.json({ notifications, unreadCount: parseInt(unreadCount.count) });
});

// Mark notification as read
router.put('/:id/read', authMiddleware, async (req, res) => {
  await db.run('UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'Marked as read' });
});

// Mark all as read
router.put('/read-all', authMiddleware, async (req, res) => {
  const { familyId } = req.body;
  if (familyId) {
    await db.run('UPDATE notifications SET read = 1 WHERE user_id = ? AND family_id = ?', [req.user.id, familyId]);
  } else {
    await db.run('UPDATE notifications SET read = 1 WHERE user_id = ?', [req.user.id]);
  }
  res.json({ message: 'All marked as read' });
});

module.exports = router;
