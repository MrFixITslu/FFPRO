import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { encryptForUser, decryptForUser } from '../crypto.js';

const router = Router();

// Generous but bounded — this holds one user's entire finance dataset
// (transactions, budgets, goals, etc.) as JSON, not file uploads.
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT ciphertext, iv, auth_tag, version, updated_at FROM user_data WHERE user_id = $1',
      [req.user.id]
    );
    if (!rows[0]) {
      return res.json({ data: null, version: 0, updatedAt: null });
    }
    const row = rows[0];
    const data = decryptForUser(req.user.id, {
      ciphertext: row.ciphertext,
      iv: row.iv,
      authTag: row.auth_tag,
    });
    res.json({ data, version: row.version, updatedAt: row.updated_at });
  } catch (err) {
    console.error('GET /api/data error:', err);
    res.status(500).json({ error: 'Failed to load your data.' });
  }
});

router.put('/', async (req, res) => {
  const { data, expectedVersion } = req.body || {};
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid payload.' });
  }
  if (typeof expectedVersion !== 'number') {
    return res.status(400).json({ error: 'expectedVersion is required.' });
  }

  let serialized;
  try {
    serialized = JSON.stringify(data);
  } catch {
    return res.status(400).json({ error: 'Payload is not serializable.' });
  }
  if (Buffer.byteLength(serialized, 'utf8') > MAX_BYTES) {
    return res.status(413).json({ error: 'Data payload too large.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Lock this user's row (if any) so two concurrent saves from the same
    // account can't both read the same version and silently clobber one another.
    const { rows } = await client.query(
      'SELECT version FROM user_data WHERE user_id = $1 FOR UPDATE',
      [req.user.id]
    );
    const currentVersion = rows[0]?.version || 0;

    if (expectedVersion !== currentVersion) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Data was updated elsewhere since you last loaded it.',
        version: currentVersion,
      });
    }

    const { ciphertext, iv, authTag } = encryptForUser(req.user.id, data);
    const newVersion = currentVersion + 1;

    await client.query(
      `INSERT INTO user_data (user_id, ciphertext, iv, auth_tag, version, updated_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE
         SET ciphertext = EXCLUDED.ciphertext,
             iv = EXCLUDED.iv,
             auth_tag = EXCLUDED.auth_tag,
             version = EXCLUDED.version,
             updated_at = now()`,
      [req.user.id, ciphertext, iv, authTag, newVersion]
    );
    await client.query('COMMIT');
    res.json({ ok: true, version: newVersion });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /api/data error:', err);
    res.status(500).json({ error: 'Failed to save your data.' });
  } finally {
    client.release();
  }
});

// Used by "Purge data" in Settings so a reset actually resets the account,
// not just the local browser cache (which would otherwise be overwritten
// again on next login by the still-present cloud copy).
router.delete('/', async (req, res) => {
  try {
    await pool.query('DELETE FROM user_data WHERE user_id = $1', [req.user.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/data error:', err);
    res.status(500).json({ error: 'Failed to delete your data.' });
  }
});

export default router;
