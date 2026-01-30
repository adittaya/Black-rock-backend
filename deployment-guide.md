# Deployment Guide for Black Rock Backend

This guide explains how to deploy the Black Rock backend to Render.

## Prerequisites

- A Render account (https://render.com)
- Access to the GitHub repository: https://github.com/adittaya/Black-rock-backend

## Steps

### 1. Create a New Web Service on Render

1. Log in to your Render dashboard
2. Click "New +" and select "Web Service"
3. Connect to your GitHub account if prompted
4. Select the `adittaya/Black-rock-backend` repository

### 2. Configure the Web Service

- **Environment**: Node
- **Branch**: master
- **Name**: black-rock-api (or your preferred name)
- **Region**: Choose your preferred region

### 3. Set Build and Start Commands

- **Build Command**: `npm install`
- **Start Command**: `npm start`

### 4. Configure Environment Variables

Add the following environment variable:

- **Key**: `JWT_SECRET`
- **Value**: `sCDX+0POHBcoEK00pKw1CbjomD05LAH/h5fGt3/M2y2e5a3D6862ZFu0Asz7veFCirIje8yx0rspG76ytC1UhQ==`

> Note: This is the same JWT secret used in the frontend for token validation

### 5. Complete the Setup

1. Click "Create Web Service"
2. Wait for the build and deployment to complete
3. Note the URL assigned to your service (e.g., `https://your-service-name.onrender.com`)

### 6. Update Frontend Configuration

Once deployed, update the `VITE_BACKEND_URL` in your frontend environment files to point to your new Render service:

```
VITE_BACKEND_URL=https://your-service-name.onrender.com
```

## API Endpoints

After deployment, the following endpoints will be available:

- `POST /refresh-token` - Refresh authentication tokens
- `POST /validate-token` - Validate tokens
- `GET /get-profile` - Get user profile
- `PUT /update-profile` - Update user profile
- `POST /register` - Register new users
- `POST /login` - User login
- `GET /` - Health check

## Verification

To verify the deployment:

1. Visit the root URL of your service - should return a health check response
2. Check the Render dashboard logs for any errors
3. Test the `/refresh-token` endpoint with a valid JWT token

## Troubleshooting

- If the service fails to start, check the logs in the Render dashboard
- Ensure the JWT_SECRET environment variable is set correctly
- Verify that the port is correctly configured (defaults to 3000 if not set)

## Scaling

Render automatically handles scaling based on traffic. Monitor your service usage in the Render dashboard to adjust resources as needed.