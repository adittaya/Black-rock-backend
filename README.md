# Black Rock Backend API

This is the backend server for the BlackRock Financial Analytics Platform, providing user authentication, profile management, transaction processing, and AI integration services.

## Features
- User registration and authentication with JWT
- Profile management and updates
- Transaction processing
- AI context builder with Pollinations API integration
- Firebase Firestore integration for data persistence
- Secure token management with refresh tokens

## API Endpoints

### Authentication
- `POST /login` - Authenticate user and return JWT token
- `POST /refresh-token` - Refresh expired JWT token
- `POST /validate-token` - Validate existing JWT token

### User Profile
- `GET /get-profile` - Retrieve user profile (requires valid JWT token)
- `PUT /update-profile` - Update user profile (requires valid JWT token)

### Registration
- `POST /register` - Register new user

### AI Services
- `POST /api/ai-context-builder` - AI context builder with Pollinations integration (requires valid JWT token)

### Additional Endpoints
- `GET /users` - Get all users (requires auth)
- `GET /users/:userId` - Get specific user (requires auth)
- `GET /products` - Get available products
- `GET /investments` - Get all investments (requires auth)
- `POST /investments` - Create investment (requires auth)
- `PUT /investments/:investmentId` - Update investment status (requires auth)
- `GET /transactions` - Get all transactions (requires auth)
- `POST /transactions` - Create transaction (requires auth)
- `PUT /transactions/:transactionId` - Update transaction status (requires auth)
- `GET /admin/settings` - Get admin settings (requires auth)
- `PUT /admin/settings` - Update admin settings (requires auth)
- `GET /support-messages` - Get all support messages (requires auth)
- `POST /support-messages` - Create support message (requires auth)
- `PUT /support-messages/:messageId` - Update support message status (requires auth)
- And many more endpoints for full platform functionality

## Environment Variables
- `JWT_SECRET` - Secret key for signing JWT tokens
- `REFRESH_TOKEN_SECRET` - Secret key for refresh tokens
- `POLLINATIONS_API_KEY` - API key for Pollinations service
- `FIREBASE_*` - All Firebase configuration variables
- `PORT` - Port number for the server (defaults to 3000)

## Tech Stack
- Node.js with Express
- Firebase Firestore for data storage
- JWT for authentication
- Axios for HTTP requests
- Pollinations API for AI features

## Deployment
This service is designed to be deployed on Render with the configuration in `render.yaml`.