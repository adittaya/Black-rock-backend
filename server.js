const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  }
});

// Get JWT secret and Pollinations API key
const jwtSecret = process.env.JWT_SECRET;
const pollinationsApiKey = process.env.POLLINATIONS_API_KEY;

if (!jwtSecret) {
  console.error('Missing JWT_SECRET environment variable');
  process.exit(1);
}

if (!pollinationsApiKey) {
  console.error('Missing POLLINATIONS_API_KEY environment variable');
  process.exit(1);
}

// Routes
app.get('/', (req, res) => {
  res.send('Black Rock API is running!');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Proxy for user registration (with additional validation/logic if needed)
app.post('/api/auth/register', async (req, res) => {
  try {
    const { phone, password, name } = req.body;

    // Additional validation can be added here
    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    // Use Supabase Auth to create the user
    const { data, error } = await supabase.auth.admin.createUser({
      phone,
      password,
      user_metadata: { name },
      email_confirm: false, // For phone authentication
    });

    if (error) {
      console.error('Registration error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).json({ user: data.user, message: 'User registered successfully' });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Proxy for user login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { phone, password } = req.body;

    if (!phone || !password) {
      return res.status(400).json({ error: 'Phone and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      phone,
      password,
    });

    if (error) {
      console.error('Login error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).json({ session: data.session, user: data.user });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get user profile
app.get('/api/users/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization header missing or invalid' });
    }

    const token = authHeader.substring(7);
    
    // Verify the token with Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('Auth error:', error);
      return res.status(401).json({ error: 'Invalid token' });
    }

    res.status(200).json({ user });
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Black Rock API server running on port ${port}`);
});