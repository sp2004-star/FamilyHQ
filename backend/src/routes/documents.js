const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const sharp = require('sharp');
const db = require('../database');
const { authMiddleware } = require('../middleware/auth');
const { sendNewSharedDocEmail } = require('../services/email');
const { uploadFile, downloadFile, deleteFile } = require('../services/storage');

const router = express.Router();

// Use memory storage - files go to buffer, then to Supabase
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
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
async function checkMembership(familyId, userId) {
  return db.get('SELECT * FROM family_members WHERE family_id = ? AND user_id = ?', [familyId, userId]);
}

// Upload a document
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'File is required' });

    const { familyId, name, category, documentType, visibility, expiryDate } = req.body;

    if (!familyId || !name || !category) {
      return res.status(400).json({ error: 'familyId, name, and category are required' });
    }

    const membership = await checkMembership(familyId, req.user.id);
    if (!membership) return res.status(403).json({ error: 'You are not a member of this family' });

    const docId = uuidv4();
    const ext = path.extname(req.file.originalname);
    const storagePath = `${familyId}/${req.user.id}/${docId}${ext}`;

    // Upload to Supabase Storage
    await uploadFile(storagePath, req.file.buffer, req.file.mimetype);

    await db.run(`
      INSERT INTO documents (id, family_id, uploaded_by, name, original_filename, file_path, mime_type, file_size, category, document_type, visibility, expiry_date)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [docId, familyId, req.user.id, name, req.file.originalname, storagePath,
        req.file.mimetype, req.file.size, category, documentType || 'Other',
        visibility || 'private', expiryDate || null]);

    // Notify family members about shared documents
    if (visibility === 'shared') {
      const members = await db.all(
        'SELECT user_id FROM family_members WHERE family_id = ? AND user_id != ?',
        [familyId, req.user.id]
      );

      const family = await db.get('SELECT name FROM families WHERE id = ?', [familyId]);

      for (const member of members) {
        await db.run(
          'INSERT INTO notifications (id, user_id, family_id, type, title, message) VALUES (?, ?, ?, ?, ?, ?)',
          [uuidv4(), member.user_id, familyId, 'new_shared_doc', 'New shared document', `${req.user.name} shared "${name}" in ${family.name}`]
        );

        const memberUser = await db.get('SELECT email FROM users WHERE id = ?', [member.user_id]);
        sendNewSharedDocEmail({
          to: memberUser.email,
          uploaderName: req.user.name,
          documentName: name,
          familyName: family.name,
        });
      }
    }

    const doc = await db.get('SELECT * FROM documents WHERE id = ?', [docId]);
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
router.get('/family/:familyId', authMiddleware, async (req, res) => {
  const membership = await checkMembership(req.params.familyId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a member of this family' });

  const docs = await db.all(`
    SELECT d.*, u.name as uploaded_by_name
    FROM documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.family_id = ? AND (d.visibility = 'shared' OR d.uploaded_by = ?)
    ORDER BY d.created_at DESC
  `, [req.params.familyId, req.user.id]);

  res.json(docs);
});

// Get a single document
router.get('/:id', authMiddleware, async (req, res) => {
  const doc = await db.get(`
    SELECT d.*, u.name as uploaded_by_name
    FROM documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.id = ?
  `, [req.params.id]);

  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = await checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.visibility === 'private' && doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'This document is private' });
  }

  res.json(doc);
});

// Thumbnail for a document
router.get('/:id/thumbnail', authMiddleware, async (req, res) => {
  const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = await checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.visibility === 'private' && doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'This document is private' });
  }

  const imageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!imageTypes.includes(doc.mime_type)) {
    return res.status(400).json({ error: 'Thumbnails only available for image files' });
  }

  try {
    // Download from Supabase, generate thumbnail on-the-fly
    const fileBuffer = await downloadFile(doc.file_path);
    const thumbBuffer = await sharp(fileBuffer)
      .resize(160, 160, { fit: 'cover', position: 'center' })
      .webp({ quality: 75 })
      .toBuffer();

    res.set('Content-Type', 'image/webp');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(thumbBuffer);
  } catch (err) {
    console.error('Thumbnail generation error:', err.message);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// Download a document
router.get('/:id/download', authMiddleware, async (req, res) => {
  const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = await checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.visibility === 'private' && doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'This document is private' });
  }

  try {
    const fileBuffer = await downloadFile(doc.file_path);
    res.set('Content-Type', doc.mime_type || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${doc.original_filename}"`);
    res.send(fileBuffer);
  } catch (err) {
    console.error('Download error:', err.message);
    res.status(404).json({ error: 'File not found in storage' });
  }
});

// Update a document
router.put('/:id', authMiddleware, async (req, res) => {
  const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = await checkMembership(doc.family_id, req.user.id);
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
    await db.run('DELETE FROM reminder_log WHERE document_id = ?', [req.params.id]);
  }

  if (updates.length === 0) return res.status(400).json({ error: 'No updates provided' });

  updates.push('updated_at = NOW()');
  values.push(req.params.id);

  await db.run(`UPDATE documents SET ${updates.join(', ')} WHERE id = ?`, values);

  const updated = await db.get('SELECT d.*, u.name as uploaded_by_name FROM documents d JOIN users u ON u.id = d.uploaded_by WHERE d.id = ?', [req.params.id]);
  res.json(updated);
});

// Delete a document
router.delete('/:id', authMiddleware, async (req, res) => {
  const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = await checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only the owner or admin can delete this document' });
  }

  // Delete from Supabase Storage
  await deleteFile(doc.file_path);

  await db.run('DELETE FROM documents WHERE id = ?', [req.params.id]);
  res.json({ message: 'Document deleted' });
});

// Create external share link
router.post('/:id/share', authMiddleware, async (req, res) => {
  const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = await checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (doc.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only the owner or admin can share externally' });
  }

  const { expiresInHours } = req.body;
  const hours = Math.min(Math.max(expiresInHours || 24, 1), 168);
  const token = crypto.randomBytes(32).toString('hex');
  const shareId = uuidv4();
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

  await db.run(
    'INSERT INTO external_shares (id, document_id, token, created_by, expires_at) VALUES (?, ?, ?, ?, ?)',
    [shareId, req.params.id, token, req.user.id, expiresAt]
  );

  const shareLink = `${process.env.FRONTEND_URL || ''}/shared/${token}`;
  res.status(201).json({ shareId, token, shareLink, expiresAt });
});

// Get external shares for a document
router.get('/:id/shares', authMiddleware, async (req, res) => {
  const doc = await db.get('SELECT * FROM documents WHERE id = ?', [req.params.id]);
  if (!doc) return res.status(404).json({ error: 'Document not found' });

  const membership = await checkMembership(doc.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  const shares = await db.all('SELECT * FROM external_shares WHERE document_id = ? ORDER BY created_at DESC', [req.params.id]);
  res.json(shares);
});

// Revoke external share
router.delete('/shares/:shareId', authMiddleware, async (req, res) => {
  const share = await db.get('SELECT es.*, d.family_id, d.uploaded_by FROM external_shares es JOIN documents d ON d.id = es.document_id WHERE es.id = ?', [req.params.shareId]);
  if (!share) return res.status(404).json({ error: 'Share not found' });

  const membership = await checkMembership(share.family_id, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Access denied' });

  if (share.uploaded_by !== req.user.id && membership.role !== 'admin') {
    return res.status(403).json({ error: 'Only owner or admin can revoke shares' });
  }

  await db.run('UPDATE external_shares SET revoked = 1 WHERE id = ?', [req.params.shareId]);
  res.json({ message: 'Share revoked' });
});

// Access externally shared document (public)
router.get('/shared/:token', async (req, res) => {
  const share = await db.get(`
    SELECT es.*, d.name, d.original_filename, d.mime_type, d.file_path, d.file_size
    FROM external_shares es
    JOIN documents d ON d.id = es.document_id
    WHERE es.token = ?
  `, [req.params.token]);

  if (!share) return res.status(404).json({ error: 'Share link not found' });
  if (share.revoked) return res.status(410).json({ error: 'This share link has been revoked' });
  if (new Date(share.expires_at) < new Date()) return res.status(410).json({ error: 'This share link has expired' });

  res.json({ name: share.name, originalFilename: share.original_filename, mimeType: share.mime_type, fileSize: share.file_size });
});

// Download externally shared document (public)
router.get('/shared/:token/download', async (req, res) => {
  const share = await db.get(`
    SELECT es.*, d.original_filename, d.file_path, d.mime_type
    FROM external_shares es
    JOIN documents d ON d.id = es.document_id
    WHERE es.token = ?
  `, [req.params.token]);

  if (!share) return res.status(404).json({ error: 'Share link not found' });
  if (share.revoked) return res.status(410).json({ error: 'This share link has been revoked' });
  if (new Date(share.expires_at) < new Date()) return res.status(410).json({ error: 'This share link has expired' });

  try {
    const fileBuffer = await downloadFile(share.file_path);
    res.set('Content-Type', share.mime_type || 'application/octet-stream');
    res.set('Content-Disposition', `attachment; filename="${share.original_filename}"`);
    res.send(fileBuffer);
  } catch (err) {
    console.error('Shared download error:', err.message);
    res.status(404).json({ error: 'File not found in storage' });
  }
});

// Dashboard data
router.get('/dashboard/:familyId', authMiddleware, async (req, res) => {
  const membership = await checkMembership(req.params.familyId, req.user.id);
  if (!membership) return res.status(403).json({ error: 'Not a member' });

  const upcomingExpiries = await db.all(`
    SELECT d.*, u.name as uploaded_by_name
    FROM documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.family_id = ? AND d.expiry_date IS NOT NULL 
      AND d.expiry_date >= NOW() AND d.expiry_date <= NOW() + INTERVAL '30 days'
      AND (d.visibility = 'shared' OR d.uploaded_by = ?)
    ORDER BY d.expiry_date ASC
  `, [req.params.familyId, req.user.id]);

  const recentShared = await db.all(`
    SELECT d.*, u.name as uploaded_by_name
    FROM documents d
    JOIN users u ON u.id = d.uploaded_by
    WHERE d.family_id = ? AND d.visibility = 'shared'
    ORDER BY d.created_at DESC
    LIMIT 10
  `, [req.params.familyId]);

  const byCategory = await db.all(`
    SELECT category, COUNT(*) as count
    FROM documents
    WHERE family_id = ? AND (visibility = 'shared' OR uploaded_by = ?)
    GROUP BY category
  `, [req.params.familyId, req.user.id]);

  const total = await db.get(`
    SELECT COUNT(*) as count FROM documents
    WHERE family_id = ? AND (visibility = 'shared' OR uploaded_by = ?)
  `, [req.params.familyId, req.user.id]);

  res.json({ upcomingExpiries, recentShared, byCategory, totalDocuments: parseInt(total.count) });
});

module.exports = router;
