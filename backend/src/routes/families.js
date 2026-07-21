const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create a new family
router.post('/', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Family name is required' });
  }

  const familyId = uuidv4();
  const memberId = uuidv4();

  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO families (id, name, created_by) VALUES (?, ?, ?)', [familyId, name.trim(), req.user.id]);
    await tx.run('INSERT INTO family_members (id, family_id, user_id, role) VALUES (?, ?, ?, ?)', [memberId, familyId, req.user.id, 'admin']);
  });

  const family = await db.get('SELECT * FROM families WHERE id = ?', [familyId]);
  res.status(201).json(family);
});

// Get all families the user belongs to
router.get('/', authMiddleware, async (req, res) => {
  const families = await db.all(`
    SELECT f.*, fm.role, 
      (SELECT COUNT(*) FROM family_members WHERE family_id = f.id) as member_count
    FROM families f
    JOIN family_members fm ON fm.family_id = f.id
    WHERE fm.user_id = ?
    ORDER BY f.created_at DESC
  `, [req.user.id]);

  res.json(families);
});

// Get a specific family
router.get('/:id', authMiddleware, async (req, res) => {
  const membership = await db.get(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );

  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of this family' });
  }

  const family = await db.get('SELECT * FROM families WHERE id = ?', [req.params.id]);
  if (!family) return res.status(404).json({ error: 'Family not found' });

  const members = await db.all(`
    SELECT fm.id as membership_id, fm.role, fm.joined_at, u.id, u.name, u.email
    FROM family_members fm
    JOIN users u ON u.id = fm.user_id
    WHERE fm.family_id = ?
    ORDER BY fm.joined_at
  `, [req.params.id]);

  res.json({ ...family, members, userRole: membership.role });
});

// Update family name (admin only)
router.put('/:id', authMiddleware, async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Family name is required' });
  }

  const membership = await db.get(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?',
    [req.params.id, req.user.id, 'admin']
  );

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can update family settings' });
  }

  await db.run('UPDATE families SET name = ?, updated_at = NOW() WHERE id = ?', [name.trim(), req.params.id]);
  const family = await db.get('SELECT * FROM families WHERE id = ?', [req.params.id]);
  res.json(family);
});

// Invite a member — generates a single-use invite link (no email sent)
router.post('/:id/invite', authMiddleware, async (req, res) => {
  const membership = await db.get(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?',
    [req.params.id, req.user.id, 'admin']
  );

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can invite members' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const inviteId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.run(
    'INSERT INTO invites (id, family_id, email, token, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)',
    [inviteId, req.params.id, '', token, req.user.id, expiresAt]
  );

  const inviteLink = `${process.env.FRONTEND_URL || ''}/invite/${token}`;

  res.status(201).json({ message: 'Invite link created', inviteId, inviteLink });
});

// Regenerate an invite link (new token, no email sent)
router.post('/:id/invite/:inviteId/resend', authMiddleware, async (req, res) => {
  const membership = await db.get(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?',
    [req.params.id, req.user.id, 'admin']
  );

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can regenerate invites' });
  }

  const invite = await db.get('SELECT * FROM invites WHERE id = ? AND family_id = ?', [req.params.inviteId, req.params.id]);
  if (!invite) return res.status(404).json({ error: 'Invite not found' });

  const newToken = crypto.randomBytes(32).toString('hex');
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  await db.run("UPDATE invites SET token = ?, expires_at = ?, status = 'pending' WHERE id = ?", [newToken, newExpiry, invite.id]);

  const inviteLink = `${process.env.FRONTEND_URL || ''}/invite/${newToken}`;

  res.json({ message: 'New invite link generated', inviteLink });
});

// Get pending invites for a family
router.get('/:id/invites', authMiddleware, async (req, res) => {
  const membership = await db.get(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?',
    [req.params.id, req.user.id, 'admin']
  );

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can view invites' });
  }

  const invites = await db.all(`
    SELECT i.*, u.name as invited_by_name 
    FROM invites i
    JOIN users u ON u.id = i.invited_by
    WHERE i.family_id = ?
    ORDER BY i.created_at DESC
  `, [req.params.id]);

  res.json(invites);
});

// Accept an invite (via token)
router.post('/join/:token', authMiddleware, async (req, res) => {
  const invite = await db.get('SELECT * FROM invites WHERE token = ?', [req.params.token]);

  if (!invite) {
    return res.status(404).json({ error: 'Invalid invite link. This invitation does not exist.' });
  }

  if (invite.status === 'accepted') {
    return res.status(410).json({ error: 'This invite has already been used.' });
  }

  if (invite.status === 'revoked') {
    return res.status(410).json({ error: 'This invite has been revoked by the admin.' });
  }

  if (new Date(invite.expires_at) < new Date()) {
    await db.run("UPDATE invites SET status = 'expired' WHERE id = ?", [invite.id]);
    return res.status(410).json({ error: 'This invite has expired. Please ask the admin to send a new invitation.' });
  }

  const existingMember = await db.get(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ?',
    [invite.family_id, req.user.id]
  );

  if (existingMember) {
    return res.status(409).json({ error: 'You are already a member of this family.' });
  }

  const memberId = uuidv4();

  await db.transaction(async (tx) => {
    await tx.run('INSERT INTO family_members (id, family_id, user_id, role) VALUES (?, ?, ?, ?)',
      [memberId, invite.family_id, req.user.id, 'member']);
    await tx.run("UPDATE invites SET status = 'accepted' WHERE id = ?", [invite.id]);
  });

  // Notify admins (outside transaction)
  const family = await db.get('SELECT * FROM families WHERE id = ?', [invite.family_id]);
  const admins = await db.all(
    "SELECT user_id FROM family_members WHERE family_id = ? AND role = 'admin'",
    [invite.family_id]
  );
  const user = await db.get('SELECT name FROM users WHERE id = ?', [req.user.id]);

  for (const admin of admins) {
    await db.run(
      'INSERT INTO notifications (id, user_id, family_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)',
      [uuidv4(), admin.user_id, invite.family_id, 'invite_accepted', 'New member joined', `${user.name} has joined ${family.name}`]
    );
  }

  res.json({ message: 'Successfully joined the family!', family });
});

// Get invite info (public - for invite page)
router.get('/invite-info/:token', async (req, res) => {
  const invite = await db.get(`
    SELECT i.*, f.name as family_name, u.name as invited_by_name
    FROM invites i
    JOIN families f ON f.id = i.family_id
    JOIN users u ON u.id = i.invited_by
    WHERE i.token = ?
  `, [req.params.token]);

  if (!invite) {
    return res.status(404).json({ error: 'Invalid invite link.' });
  }

  if (invite.status === 'accepted') {
    return res.status(410).json({ error: 'This invite has already been used.' });
  }

  if (invite.status === 'revoked') {
    return res.status(410).json({ error: 'This invite has been revoked.' });
  }

  if (new Date(invite.expires_at) < new Date()) {
    return res.status(410).json({ error: 'This invite has expired.' });
  }

  res.json({
    familyName: invite.family_name,
    invitedByName: invite.invited_by_name,
  });
});

// Remove a member (admin only)
router.delete('/:id/members/:userId', authMiddleware, async (req, res) => {
  const membership = await db.get(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?',
    [req.params.id, req.user.id, 'admin']
  );

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can remove members' });
  }

  if (req.params.userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot remove yourself' });
  }

  await db.run('DELETE FROM family_members WHERE family_id = ? AND user_id = ?', [req.params.id, req.params.userId]);
  res.json({ message: 'Member removed' });
});

// Leave a family
router.post('/:id/leave', authMiddleware, async (req, res) => {
  const membership = await db.get(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ?',
    [req.params.id, req.user.id]
  );

  if (!membership) {
    return res.status(404).json({ error: 'You are not a member of this family' });
  }

  if (membership.role === 'admin') {
    const adminCount = await db.get(
      "SELECT COUNT(*) as count FROM family_members WHERE family_id = ? AND role = 'admin'",
      [req.params.id]
    );
    if (parseInt(adminCount.count) <= 1) {
      return res.status(400).json({ error: 'You are the only admin. Promote another member to admin before leaving.' });
    }
  }

  await db.run('DELETE FROM family_members WHERE family_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ message: 'You have left the family' });
});

module.exports = router;
