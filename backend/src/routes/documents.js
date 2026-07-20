const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { sendNewSharedDocEmail } = require('../services/email');

const router = express.Router();

// Set up multer for file uploads
const uploadDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const thumbDir = path.join(__dirname, '..', '..', 'thumbnails');
if (!fs.existsSync(thumbDir)) fs.mkdirSync(thumbDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const userDir = path.join(uploadDir, req.user.id);
    if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
    cb(null, userDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed. Supported: PDF, images, Word, Excel, text files.'));
    }
  },
});

// Helper: check family membership
function checkMembership(familyId, userId) {
  return db.prepare('SELECT * FROM family_members WHERE family_id = ? AND user_id = ?').get(familyId, userId);
}

// Upload a document
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const { familyId, name, category, documentType, visibility, expiryDate } = req.body;

    if (!familyId || !name || !category) {
      return res.status(400).json({ error: 'familyId, name, and category are required' });
    }

    const membership = checkMembership(familyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'You are not a member of this family' });

    const docId = uuidv4();
    const filePath = path.relative(uploadDir, req.file.path);

    db.prepare(`
      INSERT INTO documents (id, family_id, uploaded_by, name, original_filename, file_path, mime_type, file_size, category, document_type, visibility, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      docId, familyId, req.user.id, name, req.file.originalname, filePath,
      req.file.mimetype, req.file.size, category, documentType || 'Other',
      visibility || 'private', expiryDate || null
    );

    // Notify family members about shared documents
    if (visibility === 'shared') {
      const members = db.prepare(
        'SELECT user_id FROM family_members WHERE family_id = ? AND user_id != ?'
      ).all(familyId, req.user.id);

      const family = db.prepare('SELECT name FROM families WHERE id = ?').get(familyId);

      members.forEach(member => {
        db.prepare(
          'INSERT INTO notifications (id, user_id, family_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)'
        ).run(uuidv4(), member.user_id, familyId, 'new_shared_doc', 'New shared document', `${req.user.name} shared "${name}" in ${family.name}`);

        // Send email
        const memberUser = db.prepare('SELECT email FROM users WHERE id = ?').get(member.user_id);
        sendNewSharedDocEmail({
          to: memberUser.email,
          uploaderName: req.user.name,
          documentName: name,
          familyName: family.name,
        });
      });
    }

    const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(docId);
    res.status(201).json(doc);
  } catch (error) {
    console.error('Upload error:', error);
    if (error.message?.includes('File type not allowed')) {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Upload failed' });
  }
});

// Get documents for a family
router.get('/family/:familyId', authMiddleware, (req, res) => {
  const membership = checkMembership(req.params.familyId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a member of this family' });

  const docs = db.prepare(`
    SELECT d.*, u.name as uploaded_by_name
    FROM documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.family_id = ? AND (d.visibility = 'shared' OR d.uploaded_by = ?)
    ORDER BY d.created_at DESC
  `).all(req.params.familyId, req.user.id);

  res.json(docs);
});

// Get a single document
router.get('/:id', authMiddleware, (req, res) => {
  const doc = db.prepare(`
    SELECT d.*, u.name as uploaded_by_name
    FROM documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.id = ?
  `).get(req.params.id);

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.visibility === 'private' && doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'This document is private' });
  }

  res.json(doc);
});

// Thumbnail for a document (images only - PDFs handled on frontend)
router.get('/:id/thumbnail', authMiddleware, async (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.visibility === 'private' && doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'This document is private' });
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!imageTypes.includes(doc.mime_type)) {
    return res.status(400).json({ error: 'Thumbnails only available for image files' });
  }

  const filePath = path.join(uploadDir, doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  // Check cached thumbnail
  const thumbPath = path.join(thumbDir, `${doc.id}.webp`);
  if (fs.existsSync(thumbPath)) {
    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=86400');
    return res.sendFile(thumbPath);
  }

  try {
    await sharp(filePath)
      .resize(160, 160, { fit: 'cover', position: 'center' })
      .webp({ quality: 75 })
      .toFile(thumbPath);

    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=86400');
    res.sendFile(thumbPath);
  } catch (err) {
    console.error('Thumbnail generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// Download a document
router.get('/:id/download', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.visibility === 'private' && doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'This document is private' });
  }

  const filePath = path.join(uploadDir, doc.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.download(filePath, doc.original_filename);
});

// Update a document (rename, change category, renew expiry, change visibility)
router.put('/:id', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only the owner or admin can update this document' });
  }

  const { name, category, documentType, visibility, expiryDate } = req.body;
  const updates = [];
  const values = [];

  if (name) { updates.push('name = ?'); values.push(name); }
  if (category) { updates.push('category = ?'); values.push(category); }
  if (documentType) { updates.push('document_type = ?'); values.push(documentType); }
  if (visibility) { updates.push('visibility = ?'); values.push(visibility); }
  if (expiryDate !== undefined) {
    updates.push('expiry_date = ?');
    values.push(expiryDate || null);
    // Clear reminder log when expiry is renewed
    db.prepare('DELETE FROM reminder_log WHERE document_id = ?').run(req.params.id);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

  updates.push('updated_at = datetime("now")');
  values.push(req.params.id);

  db.prepare(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`).run(...values);

  const updated = db.prepare('SELECT d.*, u.name as uploaded_by_name FROM documents d JOIN users u ON u.id = d.uploaded_by WHERE d.id = ?').get(req.params.id);
  res.json(updated);
});

// Delete a document
router.delete('/:id', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only the owner or admin can delete this document' });
  }

  // Delete file from disk
  const filePath = path.join(uploadDir, doc.file_path);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM documents WHERE id = ?').run(req.params.id);
  res.json({ message: 'Document deleted' });
});

// Create external share link
router.post('/:id/share', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only the owner or admin can share externally' });
  }

  const { expiresInHours } = req.body;
  const hours = Math.min(Math.max(expiresInHours || 24, 1), 168); // 1hr to 7 days
  const token = crypto.randomBytes(32).toString('hex');
  const shareId = uuidv4();
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  db.prepare(
    'INSERT INTO external_shares (id, document_id, token, created_by, expires_at) VALUES (?, ?, ?, ?, ?)'
  ).run(shareId, req.params.id, token, req.user.id, expiresAt);

  const shareLink = `${process.env.FRONTEND_URL}/shared/${token}`;
  res.status(201).json({ shareId, token, shareLink, expiresAt });
});

// Get external shares for a document
router.get('/:id/shares', authMiddleware, (req, res) => {
  const doc = db.prepare('SELECT * FROM documents WHERE id = ?').get(req.params.id);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  const shares = db.prepare('SELECT * FROM external_shares WHERE document_id = ? ORDER BY created_at DESC').all(req.params.id);
  res.json(shares);
});

// Revoke external share
router.delete('/shares/:shareId', authMiddleware, (req, res) => {
  const share = db.prepare('SELECT es.*, d.family_id, d.uploaded_by FROM external_shares es JOIN documents d ON d.id = es.document_id WHERE es.id = ?').get(req.params.shareId);
  if (!share) return res.status(404).json({ error: 'Share not found' });

  const membership = checkMembership(share.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (share.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only owner or admin can revoke shares' });
  }

  db.prepare('UPDATE external_shares SET revoked = 1 WHERE id = ?').run(req.params.shareId);
  res.json({ message: 'Share revoked' });
});

// Access externally shared document (public)
router.get('/shared/:token', (req, res) => {
  const share = db.prepare(`
    SELECT es.*, d.name, d.original_filename, d.mime_type, d.file_path, d.file_size
    FROM external_shares es
    JOIN documents d ON d.id = es.document_id
    WHERE es.token = ?
  `).get(req.params.token);

  if (!share) return res.status(404).json({ error: 'Share link not found' });
  if (share.revoked) return res.status(410).json({ error: 'This share link has been revoked' });
  if (new Date(share.expires_at) < new Date()) return res.status(410).json({ error: 'This share link has expired' });

  res.json({ name: share.name, originalFilename: share.original_filename, mimeType: share.mime_type, fileSize: share.file_size });
});

// Download externally shared document (public)
router.get('/shared/:token/download', (req, res) => {
  const share = db.prepare(`
    SELECT es.*, d.original_filename, d.file_path
    FROM external_shares es
    JOIN documents d ON d.id = es.document_id
    WHERE es.token = ?
  `).get(req.params.token);

  if (!share) return res.status(404).json({ error: 'Share link not found' });
  if (share.revoked) return res.status(410).json({ error: 'This share link has been revoked' });
  if (new Date(share.expires_at) < new Date()) return res.status(410).json({ error: 'This share link has expired' });

  const filePath = path.join(uploadDir, share.file_path);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  res.download(filePath, share.original_filename);
});

// Dashboard data
router.get('/dashboard/:familyId', authMiddleware, (req, res) => {
  const membership = checkMembership(req.params.familyId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a member' });

  // Upcoming expiries (next 30 days)
  const upcomingExpiries = db.prepare(`
    SELECT d.*, u.name as uploaded_by_name
    FROM documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.family_id = ? AND d.expiry_date IS NOT NULL 
      AND d.expiry_date >= date('now') AND d.expiry_date <= date('now', '+30 days')
      AND (d.visibility = 'shared' OR d.uploaded_by = ?)
    ORDER BY d.expiry_date ASC
  `).all(req.params.familyId, req.user.id);

  // Recently shared documents
  const recentShared = db.prepare(`
    SELECT d.*, u.name as uploaded_by_name
    FROM documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.family_id = ? AND d.visibility = 'shared'
    ORDER BY d.created_at DESC
    LIMIT 10
  `).all(req.params.familyId);

  // Documents grouped by category
  const byCategory = db.prepare(`
    SELECT category, COUNT(*) as count
    FROM documents
    WHERE family_id = ? AND (visibility = 'shared' OR uploaded_by = ?)
    GROUP BY category
  `).all(req.params.familyId, req.user.id);

  // Total documents
  const total = db.prepare(`
    SELECT COUNT(*) as count FROM documents
    WHERE family_id = ? AND (visibility = 'shared' OR uploaded_by = ?)
  `).get(req.params.familyId, req.user.id);

  res.json({ upcomingExpiries, recentShared, byCategory, totalDocuments: total.count });
});

module.exports = router;
