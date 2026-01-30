# Black Rock Backend API

This is the backend server for the Black Rock financial analytics platform.

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

## Environment Variables

- `JWT_SECRET` - Secret key for signing JWT tokens
- `PORT` - Port number for the server (defaults to 3000)

## Deployment

This service is designed to be deployed on Render with the configuration in `render.yaml`.