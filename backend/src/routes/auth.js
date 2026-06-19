const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/pool');
const { requireAuth, JWT_SECRET } = require('../middleware/authMiddleware');
const { asyncHandler } = require('../middleware/errorHandler');

// POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  const result = await db.query('SELECT * FROM users WHERE username = $1', [username]);
  const user = result.rows[0];

  if (!user) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ success: false, message: 'Invalid credentials' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        balance: user.balance
      }
    }
  });
}));

// POST /api/auth/client/login
router.post('/client/login', asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Username and password required' });
  }

  // 1. Check if user is a member
  let clientUser = null;
  let userType = '';

  const memberRes = await db.query('SELECT * FROM members WHERE username = $1 AND password = $2', [username, password]);
  if (memberRes.rows.length > 0) {
    clientUser = memberRes.rows[0];
    userType = 'member';
  } else {
    // 2. Check if user is a PPPoE router
    const routerRes = await db.query('SELECT * FROM routers WHERE pppoe_user = $1 AND pppoe_pass = $2', [username, password]);
    if (routerRes.rows.length > 0) {
      clientUser = routerRes.rows[0];
      userType = 'pppoe';
    }
  }

  if (!clientUser) {
    return res.status(401).json({ success: false, message: 'Username atau Password salah' });
  }

  // Generate JWT token with role 'client'
  const token = jwt.sign(
    { 
      id: clientUser.id, 
      username: userType === 'member' ? clientUser.username : clientUser.pppoe_user, 
      role: 'client',
      userType: userType
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    success: true,
    data: {
      token,
      user: {
        id: clientUser.id,
        username: userType === 'member' ? clientUser.username : clientUser.pppoe_user,
        name: userType === 'member' ? clientUser.name : clientUser.customer_name,
        role: 'client',
        userType: userType
      }
    }
  });
}));

// GET /api/auth/me
router.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await db.query('SELECT id, username, role, balance, created_at FROM users WHERE id = $1', [req.user.id]);
  const user = result.rows[0];
  
  if (!user) {
    return res.status(404).json({ success: false, message: 'User not found' });
  }

  res.json({ success: true, data: user });
}));

// PUT /api/auth/me (Change password)
router.put('/me', requireAuth, asyncHandler(async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) {
    return res.status(400).json({ success: false, message: 'Password minimal 6 karakter' });
  }

  const salt = await bcrypt.genSalt(10);
  const hashed = await bcrypt.hash(password, salt);

  await db.query('UPDATE users SET password = $1 WHERE id = $2', [hashed, req.user.id]);

  res.json({ success: true, message: 'Password berhasil diubah' });
}));

module.exports = router;
