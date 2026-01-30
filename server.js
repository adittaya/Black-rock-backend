const express = require('express');
const jwt = require('jsonwebtoken');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// JWT Secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';

// Mock user data store (in a real app, this would be a database)
const users = new Map(); // In-memory storage for demo purposes

// Middleware to verify token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// Endpoint to refresh token
app.post('/refresh-token', authenticateToken, (req, res) => {
  try {
    // Get the user from the verified token
    const user = req.user;

    // Generate a new token with updated expiration
    const newToken = jwt.sign(
      { 
        uid: user.uid,
        phone_number: user.phone_number,
        exp: Math.floor(Date.now() / 1000) + (24 * 60 * 60) // 24 hours from now
      },
      JWT_SECRET
    );

    res.json({ 
      success: true, 
      token: newToken,
      message: 'Token refreshed successfully'
    });
  } catch (error) {
    console.error('Error refreshing token:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Endpoint to validate token (for testing)
app.post('/validate-token', authenticateToken, (req, res) => {
  res.json({ 
    valid: true, 
    user: req.user,
    message: 'Token is valid'
  });
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Token refresh endpoint available at /refresh-token`);
});

module.exports = app;