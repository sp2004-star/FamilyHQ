const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { sendInviteEmail } = require('../services/email');

const router = express.Router();

// Create a new family
router.post('/', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Family name is required' });
  }

  const familyId = uuidv4();
  const memberId = uuidv4();

  const insertFamily = db.prepare('INSERT INTO families (id, name, created_by) VALUES (?, ?, ?)');
  const insertMember = db.prepare('INSERT INTO family_members (id, family_id, user_id, role) VALUES (?, ?, ?, ?)');

  const transaction = db.transaction(() => {
    insertFamily.run(familyId, name.trim(), req.user.id);
    insertMember.run(memberId, familyId, req.user.id, 'admin');
  });

  transaction();

  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(familyId);
  res.status(201).json(family);
});

// Get all families the user belongs to
router.get('/', authMiddleware, (req, res) => {
  const families = db.prepare(`
    SELECT f.*, fm.role, 
      (SELECT COUNT(*) FROM family_members WHERE family_id = f.id) as member_count
    FROM families f
    JOIN family_members fm ON fm.family_id = f.id
    WHERE fm.user_id = ?
    ORDER BY f.created_at DESC
  `).all(req.user.id);

  res.json(families);
});

// Get a specific family
router.get('/:id', authMiddleware, (req, res) => {
  const membership = db.prepare(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!membership) {
    return res.status(403).json({ error: 'You are not a member of this family' });
  }

  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id);
  if (!family) return res.status(404).json({ error: 'Family not found' });

  const members = db.prepare(`
    SELECT fm.id as membership_id, fm.role, fm.joined_at, u.id, u.name, u.email
    FROM family_members fm
    JOIN users u ON u.id = fm.user_id
    WHERE fm.family_id = ?
    ORDER BY fm.joined_at
  `).all(req.params.id);

  res.json({ ...family, members, userRole: membership.role });
});

// Update family name (admin only)
router.put('/:id', authMiddleware, (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Family name is required' });
  }

  const membership = db.prepare(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?'
  ).get(req.params.id, req.user.id, 'admin');

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can update family settings' });
  }

  db.prepare('UPDATE families SET name = ?, updated_at = datetime("now") WHERE id = ?').run(name.trim(), req.params.id);
  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(req.params.id);
  res.json(family);
});

// Invite a member
router.post('/:id/invite', authMiddleware, async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const membership = db.prepare(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?'
  ).get(req.params.id, req.user.id, 'admin');

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can invite members' });
  }

  // Check if user is already a member
  const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existingUser) {
    const existingMember = db.prepare(
      'SELECT * FROM family_members WHERE family_id = ? AND user_id = ?'
    ).get(req.params.id, existingUser.id);
    if (existingMember) {
      return res.status(409).json({ error: 'This user is already a member of this family' });
    }
  }

  // Check for existing pending invite
  const existingInvite = db.prepare(
    "SELECT * FROM invites WHERE family_id = ? AND email = ? AND status = 'pending' AND expires_at > datetime('now')"
  ).get(req.params.id, email.toLowerCase());

  if (existingInvite) {
    return res.status(409).json({ error: 'A pending invite already exists for this email. You can resend it.' });
  }

  const token = crypto.randomBytes(32).toString('hex');
  const inviteId = uuidv4();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO invites (id, family_id, email, token, invited_by, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(inviteId, req.params.id, email.toLowerCase(), token, req.user.id, expiresAt);

  const family = db.prepare('SELECT name FROM families WHERE id = ?').get(req.params.id);
  const inviteLink = `${process.env.FRONTEND_URL}/invite/${token}`;

  await sendInviteEmail({
    to: email.toLowerCase(),
    inviterName: req.user.name,
    familyName: family.name,
    inviteLink,
  });

  res.status(201).json({ message: 'Invite sent successfully', inviteId });
});

// Resend an invite
router.post('/:id/invite/:inviteId/resend', authMiddleware, async (req, res) => {
  const membership = db.prepare(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?'
  ).get(req.params.id, req.user.id, 'admin');

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can resend invites' });
  }

  const invite = db.prepare('SELECT * FROM invites WHERE id = ? AND family_id = ?').get(req.params.inviteId, req.params.id);
  if (!invite) return res.status(404).json({ error: 'Invite not found' });

  // Generate new token and extend expiry
  const newToken = crypto.randomBytes(32).toString('hex');
  const newExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  db.prepare("UPDATE invites SET token = ?, expires_at = ?, status = 'pending' WHERE id = ?").run(newToken, newExpiry, invite.id);

  const family = db.prepare('SELECT name FROM families WHERE id = ?').get(req.params.id);
  const inviteLink = `${process.env.FRONTEND_URL}/invite/${newToken}`;

  await sendInviteEmail({
    to: invite.email,
    inviterName: req.user.name,
    familyName: family.name,
    inviteLink,
  });

  res.json({ message: 'Invite resent successfully' });
});

// Get pending invites for a family
router.get('/:id/invites', authMiddleware, (req, res) => {
  const membership = db.prepare(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?'
  ).get(req.params.id, req.user.id, 'admin');

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can view invites' });
  }

  const invites = db.prepare(`
    SELECT i.*, u.name as invited_by_name 
    FROM invites i
    JOIN users u ON u.id = i.invited_by
    WHERE i.family_id = ?
    ORDER BY i.created_at DESC
  `).all(req.params.id);

  res.json(invites);
});

// Accept an invite (via token)
router.post('/join/:token', authMiddleware, (req, res) => {
  const invite = db.prepare('SELECT * FROM invites WHERE token = ?').get(req.params.token);

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
    db.prepare("UPDATE invites SET status = 'expired' WHERE id = ?").run(invite.id);
    return res.status(410).json({ error: 'This invite has expired. Please ask the admin to send a new invitation.' });
  }

  // Check if already a member
  const existingMember = db.prepare(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ?'
  ).get(invite.family_id, req.user.id);

  if (existingMember) {
    return res.status(409).json({ error: 'You are already a member of this family.' });
  }

  const memberId = uuidv4();
  const transaction = db.transaction(() => {
    db.prepare('INSERT INTO family_members (id, family_id, user_id, role) VALUES (?, ?, ?, ?)').run(
      memberId, invite.family_id, req.user.id, 'member'
    );
    db.prepare("UPDATE invites SET status = 'accepted' WHERE id = ?").run(invite.id);

    // Notify admin
    const family = db.prepare('SELECT * FROM families WHERE id = ?').get(invite.family_id);
    const admins = db.prepare(
      "SELECT user_id FROM family_members WHERE family_id = ? AND role = 'admin'"
    ).all(invite.family_id);

    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);

    admins.forEach(admin => {
      db.prepare(
        'INSERT INTO notifications (id, user_id, family_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(uuidv4(), admin.user_id, invite.family_id, 'invite_accepted',
        'New member joined',
        `${user.name} has joined ${family.name}`
      );
    });
  });

  transaction();

  const family = db.prepare('SELECT * FROM families WHERE id = ?').get(invite.family_id);
  res.json({ message: 'Successfully joined the family!', family });
});

// Get invite info (public - for invite page)
router.get('/invite-info/:token', (req, res) => {
  const invite = db.prepare(`
    SELECT i.*, f.name as family_name, u.name as invited_by_name
    FROM invites i
    JOIN families f ON f.id = i.family_id
    JOIN users u ON u.id = i.invited_by
    WHERE i.token = ?
  `).get(req.params.token);

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
    email: invite.email,
  });
});

// Remove a member (admin only)
router.delete('/:id/members/:userId', authMiddleware, (req, res) => {
  const membership = db.prepare(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ? AND role = ?'
  ).get(req.params.id, req.user.id, 'admin');

  if (!membership) {
    return res.status(403).json({ error: 'Only admins can remove members' });
  }

  if (req.params.userId === req.user.id) {
    return res.status(400).json({ error: 'You cannot remove yourself' });
  }

  db.prepare('DELETE FROM family_members WHERE family_id = ? AND user_id = ?').run(req.params.id, req.params.userId);
  res.json({ message: 'Member removed' });
});

// Leave a family
router.post('/:id/leave', authMiddleware, (req, res) => {
  const membership = db.prepare(
    'SELECT * FROM family_members WHERE family_id = ? AND user_id = ?'
  ).get(req.params.id, req.user.id);

  if (!membership) {
    return res.status(404).json({ error: 'You are not a member of this family' });
  }

  // Check if last admin
  if (membership.role === 'admin') {
    const adminCount = db.prepare(
      "SELECT COUNT(*) as count FROM family_members WHERE family_id = ? AND role = 'admin'"
    ).get(req.params.id);
    if (adminCount.count <= 1) {
      return res.status(400).json({ error: 'You are the only admin. Promote another member to admin before leaving.' });
    }
  }

  db.prepare('DELETE FROM family_members WHERE family_id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ message: 'You have left the family' });
});

module.exports = router;
