const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// JWT Secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'fallback_refresh_secret_for_development';

// Mock user data store (in a real app, this would be a database)
const users = new Map(); // In-memory storage for demo purposes
const refreshTokens = new Set(); // Store refresh tokens

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

// Endpoint to register a new user
app.post('/register', async (req, res) => {
  try {
    const { phoneNumber, password, withdrawPin, referralCode } = req.body;

    // Validate input
    if (!phoneNumber || !password || !withdrawPin) {
      return res.status(400).json({
        success: false,
        message: 'Phone number, password, and withdrawal PIN are required'
      });
    }

    // Check if user already exists
    if (users.has(phoneNumber)) {
      return res.status(409).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Hash the password using crypto
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const hashedWithdrawPin = crypto.createHash('sha256').update(withdrawPin).digest('hex');

    // Create new user
    const newUser = {
      uid: `user_${Date.now()}`, // Simple UID generation
      phoneNumber,
      password: hashedPassword,
      withdrawPin: hashedWithdrawPin,
      referralCode: referralCode || null,
      createdAt: new Date().toISOString(),
      balance: 0,
      totalInvested: 0,
      totalProfit: 0,
      level: 1,
      inviteCount: 0
    };

    // Save user
    users.set(phoneNumber, newUser);

    // Generate tokens
    const accessToken = jwt.sign(
      {
        uid: newUser.uid,
        phoneNumber: newUser.phoneNumber,
        exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
      },
      JWT_SECRET
    );

    const refreshToken = jwt.sign(
      {
        uid: newUser.uid,
        phoneNumber: newUser.phoneNumber,
      },
      REFRESH_TOKEN_SECRET
    );

    refreshTokens.add(refreshToken);

    res.json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid: newUser.uid,
        phoneNumber: newUser.phoneNumber,
        balance: newUser.balance,
        level: newUser.level
      },
      token: accessToken,
      refreshToken: refreshToken
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Endpoint to login user
app.post('/login', async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    // Validate input
    if (!phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Phone number and password are required'
      });
    }

    // Find user
    const user = users.get(phoneNumber);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password using crypto
    const hashedInputPassword = crypto.createHash('sha256').update(password).digest('hex');
    if (hashedInputPassword !== user.password) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Generate tokens
    const accessToken = jwt.sign(
      {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
      },
      JWT_SECRET
    );

    const refreshToken = jwt.sign(
      {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
      },
      REFRESH_TOKEN_SECRET
    );

    refreshTokens.add(refreshToken);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        level: user.level
      },
      token: accessToken,
      refreshToken: refreshToken
    });
  } catch (error) {
    console.error('Error logging in user:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Endpoint to get user profile
app.get('/get-profile', authenticateToken, (req, res) => {
  try {
    const user = users.get(req.user.phoneNumber);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        totalInvested: user.totalInvested,
        totalProfit: user.totalProfit,
        level: user.level,
        inviteCount: user.inviteCount
      }
    });
  } catch (error) {
    console.error('Error getting profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Endpoint to update user profile
app.put('/update-profile', authenticateToken, (req, res) => {
  try {
    const user = users.get(req.user.phoneNumber);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Update allowed fields
    const allowedUpdates = ['balance', 'totalInvested', 'totalProfit', 'level', 'inviteCount'];
    const updates = {};

    for (const [key, value] of Object.entries(req.body)) {
      if (allowedUpdates.includes(key)) {
        updates[key] = value;
      }
    }

    // Apply updates
    Object.assign(user, updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        balance: user.balance,
        totalInvested: user.totalInvested,
        totalProfit: user.totalProfit,
        level: user.level,
        inviteCount: user.inviteCount
      }
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Endpoint to refresh token
app.post('/refresh-token', (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Refresh token required' });
  }

  if (!refreshTokens.has(refreshToken)) {
    return res.status(403).json({ error: 'Invalid refresh token' });
  }

  jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err, user) => {
    if (err) {
      refreshTokens.delete(refreshToken);
      return res.status(403).json({ error: 'Invalid or expired refresh token' });
    }

    // Generate new access token
    const newAccessToken = jwt.sign(
      {
        uid: user.uid,
        phoneNumber: user.phoneNumber,
        exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
      },
      JWT_SECRET
    );

    res.json({
      success: true,
      token: newAccessToken,
      message: 'Token refreshed successfully'
    });
  });
});

// Endpoint to validate token (for testing)
app.post('/validate-token', authenticateToken, (req, res) => {
  res.json({
    valid: true,
    user: req.user,
    message: 'Token is valid'
  });
});

// AI Context Builder endpoint
app.post('/api/ai-context-builder', authenticateToken, async (req, res) => {
  try {
    const { userId, userInput, systemPrompt, image } = req.body;

    // Find user
    const user = users.get(req.user.phoneNumber);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Get the Pollinations API key from environment variables
    const pollinationsApiKey = process.env.POLLINATIONS_API_KEY;
    if (!pollinationsApiKey) {
      return res.status(500).json({
        success: false,
        message: 'Pollinations API key not configured'
      });
    }

    // Prepare the messages array for the API
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userInput }
    ];

    // Include image if provided
    if (image) {
      messages[1] = {
        role: 'user',
        content: [
          { type: 'text', text: userInput },
          { type: 'image_url', image_url: { url: image } }
        ]
      };
    }

    // Call the Pollinations API
    const response = await axios.post('https://api.pollinations.ai/v1/chat/completions', {
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 500
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pollinationsApiKey}`
      }
    });

    const aiResponse = response.data.choices[0]?.message?.content || "I'm here to help! Could you clarify?";

    res.json({
      success: true,
      text: aiResponse,
      userId: user.uid,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in AI context builder:', error);

    // Return a generic response if the API call fails
    const fallbackResponse = "Thank you for your message. As your customer care executive, I'm here to assist you with your BlackRock Financial Analytics Platform account. How else may I assist you today?";

    res.status(200).json({
      success: true,
      text: fallbackResponse,
      userId: req.user.phoneNumber,
      timestamp: new Date().toISOString()
    });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ status: 'Server is running', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`- POST /register - Register a new user`);
  console.log(`- POST /login - Login user`);
  console.log(`- GET /get-profile - Get user profile (requires auth)`);
  console.log(`- PUT /update-profile - Update user profile (requires auth)`);
  console.log(`- POST /refresh-token - Refresh access token`);
  console.log(`- POST /validate-token - Validate token (requires auth)`);
  console.log(`- POST /api/ai-context-builder - AI context builder (requires auth)`);
});

module.exports = app;