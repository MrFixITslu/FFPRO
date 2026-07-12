import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { encryptForUser, decryptForUser } from '../crypto.js';
import rateLimit from 'express-rate-limit';

const router = Router();
const MAX_BYTES = 5 * 1024 * 1024; // 5MB limit

// FIX: Add schema validation for data payloads
function validateAppState(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return 'Invalid data format.';
  }
  
  // Basic structure validation
  if (data.transactions && !Array.isArray(data.transactions)) {
    return 'Transactions must be an array.';
  }
  if (data.recurringExpenses && !Array.isArray(data.recurringExpenses)) {
    return 'Recurring expenses must be an array.';
  }
  if (data.recurringIncomes && !Array.isArray(data.recurringIncomes)) {
    return 'Recurring incomes must be an array.';
  }
  if (data.savingGoals && !Array.isArray(data.savingGoals)) {
    return 'Saving goals must be an array.';
  }
  if (data.investmentGoals && !Array.isArray(data.investmentGoals)) {
    return 'Investment goals must be an array.';
  }
  if (data.contacts && !Array.isArray(data.contacts)) {
    return 'Contacts must be an array.';
  }
  if (data.events && !Array.isArray(data.events)) {
    return 'Events must be an array.';
  }
  if (data.categoryBudgets && typeof data.categoryBudgets !== 'object') {
    return 'Category budgets must be an object.';
  }
  if (data.bankConnections && !Array.isArray(data.bankConnections)) {
    return 'Bank connections must be an array.';
  }
  
  return null;
}

// Generous but bounded write limiter for data sync
const dataWriteLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false
});

router.use(requireAuth);

// FIX: Apply rate limiting to all write operations (GET is exempt)
router.put('/', dataWriteLimiter);
router.delete('/', dataWriteLimiter);

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
  
  // FIX: Add comprehensive schema validation
  const validationError = validateAppState(data);
  if (validationError || typeof data !== 'object' || data === null || Array.isArray(data)) {
    return res.status(400).json({ error: validationError || 'Invalid payload.' });
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
