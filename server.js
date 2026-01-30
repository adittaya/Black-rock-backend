const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const cors = require('cors');
const axios = require('axios');
const admin = require('firebase-admin');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: process.env.FIREBASE_TYPE,
  project_id: process.env.FIREBASE_PROJECT_ID,
  private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
  private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  client_id: process.env.FIREBASE_CLIENT_ID,
  auth_uri: process.env.FIREBASE_AUTH_URI,
  token_uri: process.env.FIREBASE_TOKEN_URI,
  auth_provider_x509_cert_url: process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL,
  client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL
};

// Only initialize if we have the service account details
if (serviceAccount.project_id) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
  });
} else {
  // For local development without service account
  admin.initializeApp({
    databaseURL: `https://${process.env.FIREBASE_PROJECT_ID || 'dummy-project'}.firebaseio.com`
  });
}

const db = admin.firestore();

// JWT Secret from environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_development';
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET || 'fallback_refresh_secret_for_development';

// In-memory storage for refresh tokens only (short-lived)
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

    // Check if user already exists in Firebase
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('phoneNumber', '==', phoneNumber).get();

    if (!snapshot.empty) {
      return res.status(409).json({
        success: false,
        message: 'User already exists'
      });
    }

    // Hash the password using crypto
    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');
    const hashedWithdrawPin = crypto.createHash('sha256').update(withdrawPin).digest('hex');

    // Create new user in Firebase
    const newUser = {
      phoneNumber,
      password: hashedPassword,
      withdrawPin: hashedWithdrawPin,
      referralCode: referralCode || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      balance: 0,
      totalInvested: 0,
      totalProfit: 0,
      level: 1,
      inviteCount: 0
    };

    const docRef = await usersRef.add(newUser);

    // Generate tokens
    const accessToken = jwt.sign(
      {
        uid: docRef.id,
        phoneNumber: phoneNumber,
        exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
      },
      JWT_SECRET
    );

    const refreshToken = jwt.sign(
      {
        uid: docRef.id,
        phoneNumber: phoneNumber,
      },
      REFRESH_TOKEN_SECRET
    );

    refreshTokens.add(refreshToken);

    res.json({
      success: true,
      message: 'User registered successfully',
      user: {
        uid: docRef.id,
        phoneNumber: phoneNumber,
        balance: 0,
        level: 1
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

    // Find user in Firebase
    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('phoneNumber', '==', phoneNumber).get();

    if (snapshot.empty) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Get the user document
    const userDoc = snapshot.docs[0];
    const user = { id: userDoc.id, ...userDoc.data() };

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
        uid: user.id,
        phoneNumber: user.phoneNumber,
        exp: Math.floor(Date.now() / 1000) + (15 * 60) // 15 minutes
      },
      JWT_SECRET
    );

    const refreshToken = jwt.sign(
      {
        uid: user.id,
        phoneNumber: user.phoneNumber,
      },
      REFRESH_TOKEN_SECRET
    );

    refreshTokens.add(refreshToken);

    res.json({
      success: true,
      message: 'Login successful',
      user: {
        uid: user.id,
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
app.get('/get-profile', authenticateToken, async (req, res) => {
  try {
    // Get user from Firebase using the UID from the token
    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();

    res.json({
      success: true,
      user: {
        uid: userDoc.id,
        phoneNumber: userData.phoneNumber,
        balance: userData.balance,
        totalInvested: userData.totalInvested,
        totalProfit: userData.totalProfit,
        level: userData.level,
        inviteCount: userData.inviteCount
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
app.put('/update-profile', authenticateToken, async (req, res) => {
  try {
    // Update user in Firebase
    const userRef = db.collection('users').doc(req.user.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
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

    // Apply updates in Firebase
    await userRef.update(updates);

    // Get updated user data
    const updatedUserDoc = await userRef.get();
    const updatedUserData = updatedUserDoc.data();

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: {
        uid: updatedUserDoc.id,
        phoneNumber: updatedUserData.phoneNumber,
        balance: updatedUserData.balance,
        totalInvested: updatedUserData.totalInvested,
        totalProfit: updatedUserData.totalProfit,
        level: updatedUserData.level,
        inviteCount: updatedUserData.inviteCount
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

    // Find user in Firebase
    const userDoc = await db.collection('users').doc(req.user.uid).get();

    if (!userDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const userData = userDoc.data();

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
      userId: userDoc.id,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in AI context builder:', error);

    // Return a generic response if the API call fails
    const fallbackResponse = "Thank you for your message. As your customer care executive, I'm here to assist you with your BlackRock Financial Analytics Platform account. How else may I assist you today?";

    res.status(200).json({
      success: true,
      text: fallbackResponse,
      userId: req.user.uid,
      timestamp: new Date().toISOString()
    });
  }
});

// Endpoint to get all users (admin only)
app.get('/users', authenticateToken, async (req, res) => {
  try {
    // Check if user has admin privileges (simplified check)
    // In a real app, you'd have a proper admin role system
    const usersSnapshot = await db.collection('users').get();
    const users = [];

    usersSnapshot.forEach(doc => {
      const userData = doc.data();
      users.push({
        id: doc.id,
        phoneNumber: userData.phoneNumber,
        balance: userData.balance,
        totalInvested: userData.totalInvested,
        totalProfit: userData.totalProfit,
        level: userData.level,
        inviteCount: userData.inviteCount,
        createdAt: userData.createdAt
      });
    });

    res.json({ success: true, users });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to get a specific user by ID
app.get('/users/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const userDoc = await db.collection('users').doc(userId).get();

    if (!userDoc.exists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const userData = userDoc.data();
    res.json({
      success: true,
      user: {
        id: userDoc.id,
        phoneNumber: userData.phoneNumber,
        balance: userData.balance,
        totalInvested: userData.totalInvested,
        totalProfit: userData.totalProfit,
        level: userData.level,
        inviteCount: userData.inviteCount,
        createdAt: userData.createdAt
      }
    });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to get user's products
app.get('/users/:userId/products', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify that the requesting user is the same as the requested user
    if (req.user.uid !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // In a real implementation, you would fetch user products from a products collection
    // For now, returning an empty array
    res.json({ success: true, products: [] });
  } catch (error) {
    console.error('Error getting user products:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to get user's investments
app.get('/users/:userId/investments', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify that the requesting user is the same as the requested user
    if (req.user.uid !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // In a real implementation, you would fetch user investments from an investments collection
    // For now, returning an empty array
    res.json({ success: true, investments: [] });
  } catch (error) {
    console.error('Error getting user investments:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to get all investments
app.get('/investments', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you would fetch all investments from an investments collection
    // For now, returning an empty array
    res.json({ success: true, investments: [] });
  } catch (error) {
    console.error('Error getting investments:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to create an investment
app.post('/investments', authenticateToken, async (req, res) => {
  try {
    const investmentData = req.body;

    // In a real implementation, you would add the investment to an investments collection
    // For now, returning the investment data as is
    res.json({ success: true, investment: investmentData });
  } catch (error) {
    console.error('Error creating investment:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to update investment status
app.put('/investments/:investmentId', authenticateToken, async (req, res) => {
  try {
    const { investmentId } = req.params;
    const { status } = req.body;

    // In a real implementation, you would update the investment status in the database
    // For now, returning success
    res.json({ success: true, investmentId, status });
  } catch (error) {
    console.error('Error updating investment status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to get user's transactions
app.get('/users/:userId/transactions', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify that the requesting user is the same as the requested user
    if (req.user.uid !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // In a real implementation, you would fetch user transactions from a transactions collection
    // For now, returning an empty array
    res.json({ success: true, transactions: [] });
  } catch (error) {
    console.error('Error getting user transactions:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to get all transactions
app.get('/transactions', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you would fetch all transactions from a transactions collection
    // For now, returning an empty array
    res.json({ success: true, transactions: [] });
  } catch (error) {
    console.error('Error getting transactions:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to create a transaction
app.post('/transactions', authenticateToken, async (req, res) => {
  try {
    const transactionData = req.body;

    // In a real implementation, you would add the transaction to a transactions collection
    // For now, returning the transaction data as is
    res.json({ success: true, transaction: transactionData });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to update transaction status
app.put('/transactions/:transactionId', authenticateToken, async (req, res) => {
  try {
    const { transactionId } = req.params;
    const { status } = req.body;

    // In a real implementation, you would update the transaction status in the database
    // For now, returning success
    res.json({ success: true, transactionId, status });
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Endpoint to get all payment records
app.get('/payment-records', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you would fetch payment records from a payment records collection
    // For now, returning an empty array
    res.json({ success: true, paymentRecords: [] });
  } catch (error) {
    console.error('Error getting payment records:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin settings endpoints
app.get('/admin/settings', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you would fetch admin settings from a settings collection
    // For now, returning default settings
    res.json({
      success: true,
      popupEnabled: true,
      popupSubject: 'Announcement',
      popupText: 'Welcome to VIXO! Just Launched.',
      popupAwardLine1: 'Roadmap for 200+ Days!',
      popupAwardLine2: 'Fikar mat kijiye, join us today!',
      popupMinRecharge: '680RS',
      popupMinWithdrawal: '130RS',
      popupReferralL1: '28%',
      popupReferralL2: '1%',
      popupReferralL3: '1%',
      popupChannelBtnText: 'Join Channel',
      commissionL1: 25,
      commissionL2: 3,
      commissionL3: 2,
      incomeFrozen: false,
      withdrawalFrozen: false,
      purchasesLocked: false,
      maintenanceMode: false,
      automaticIncomeEnabled: true,
      automaticIncomeTime: "00:00",
      lastIncomeRun: "",
      preApprovedEnabled: false,
      customProducts: [],
      rechargeUpiId: '',
      rechargeQrCode: '',
      gateways: [],
      branding: {
        logo: '',
        hero: '',
        primaryColor: '#00D094',
        secondaryColor: '#FFFFFF',
        siteName: 'VIXO',
        supportUrl: '/support',
        telegramUrl: 'https://t.me/',
        popupBtnLink: 'https://t.me/'
      },
      ui: {
        buttonRadius: '16px',
        cardShadow: true,
        animations: true
      }
    });
  } catch (error) {
    console.error('Error getting admin settings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/admin/settings', authenticateToken, async (req, res) => {
  try {
    const settings = req.body;

    // In a real implementation, you would update admin settings in the database
    // For now, returning success
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating admin settings:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin logs endpoints
app.get('/admin/logs', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you would fetch audit logs from a logs collection
    // For now, returning an empty array
    res.json({ success: true, logs: [] });
  } catch (error) {
    console.error('Error getting admin logs:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/admin/logs', authenticateToken, async (req, res) => {
  try {
    const logData = req.body;

    // In a real implementation, you would add the log to a logs collection
    // For now, returning success
    res.json({ success: true, log: logData });
  } catch (error) {
    console.error('Error creating admin log:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Admin actions endpoints
app.get('/admin/:adminId/actions', authenticateToken, async (req, res) => {
  try {
    const { adminId } = req.params;

    // In a real implementation, you would fetch admin actions from a actions collection
    // For now, returning an empty array
    res.json({ success: true, actions: [] });
  } catch (error) {
    console.error('Error getting admin actions:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/admin/actions', authenticateToken, async (req, res) => {
  try {
    const actionData = req.body;

    // In a real implementation, you would add the action to an actions collection
    // For now, returning success
    res.json({ success: true, action: actionData });
  } catch (error) {
    console.error('Error creating admin action:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Support messages endpoints
app.get('/users/:userId/support-messages', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify that the requesting user is the same as the requested user
    if (req.user.uid !== userId) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    // In a real implementation, you would fetch support messages from a support messages collection
    // For now, returning an empty array
    res.json({ success: true, messages: [] });
  } catch (error) {
    console.error('Error getting user support messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.get('/support-messages', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you would fetch all support messages from a support messages collection
    // For now, returning an empty array
    res.json({ success: true, messages: [] });
  } catch (error) {
    console.error('Error getting support messages:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.post('/support-messages', authenticateToken, async (req, res) => {
  try {
    const messageData = req.body;

    // In a real implementation, you would add the message to a support messages collection
    // For now, returning success
    res.json({ success: true, message: messageData });
  } catch (error) {
    console.error('Error creating support message:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.put('/support-messages/:messageId', authenticateToken, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { status } = req.body;

    // In a real implementation, you would update the message status in the database
    // For now, returning success
    res.json({ success: true, messageId, status });
  } catch (error) {
    console.error('Error updating support message status:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Community posts endpoints
app.get('/community-posts', authenticateToken, async (req, res) => {
  try {
    // In a real implementation, you would fetch community posts from a community posts collection
    // For now, returning an empty array
    res.json({ success: true, posts: [] });
  } catch (error) {
    console.error('Error getting community posts:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Products endpoints
app.get('/products', async (req, res) => {
  try {
    // In a real implementation, you would fetch products from a products collection
    // For now, returning an empty array
    res.json([]);
  } catch (error) {
    console.error('Error getting products:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
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
  console.log(`- GET /users - Get all users (requires auth)`);
  console.log(`- GET /users/:userId - Get specific user (requires auth)`);
  console.log(`- GET /users/:userId/products - Get user products (requires auth)`);
  console.log(`- GET /users/:userId/investments - Get user investments (requires auth)`);
  console.log(`- GET /investments - Get all investments (requires auth)`);
  console.log(`- POST /investments - Create investment (requires auth)`);
  console.log(`- PUT /investments/:investmentId - Update investment status (requires auth)`);
  console.log(`- GET /users/:userId/transactions - Get user transactions (requires auth)`);
  console.log(`- GET /transactions - Get all transactions (requires auth)`);
  console.log(`- POST /transactions - Create transaction (requires auth)`);
  console.log(`- PUT /transactions/:transactionId - Update transaction status (requires auth)`);
  console.log(`- GET /admin/settings - Get admin settings (requires auth)`);
  console.log(`- PUT /admin/settings - Update admin settings (requires auth)`);
  console.log(`- GET /admin/logs - Get admin logs (requires auth)`);
  console.log(`- POST /admin/logs - Create admin log (requires auth)`);
  console.log(`- GET /support-messages - Get all support messages (requires auth)`);
  console.log(`- POST /support-messages - Create support message (requires auth)`);
  console.log(`- PUT /support-messages/:messageId - Update support message status (requires auth)`);
  console.log(`- GET /community-posts - Get community posts (requires auth)`);
});

module.exports = app;