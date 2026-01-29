# Black Rock Backend API

This is the backend API for the Black Rock project, designed to be deployed on Render.

## Local Development

To run the backend locally:

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file with the following variables:
```env
SUPABASE_URL=https://cjpaohxjmsucfizsqflq.supabase.co
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY_HERE
JWT_SECRET=sCDX+0POHBcoEK00pKw1CbjomD05LAH/h5fGt3/M2y2e5a3D6862ZFu0Asz7veFCirIje8yx0rspG76ytC1UhQ==
POLLINATIONS_API_KEY=sk_aRMDlzZq5H1go5NrbWA7rD0c1l95W0Gr
PORT=3001
```

3. Start the development server:
```bash
npm run dev
```

## Environment Variables

- `SUPABASE_URL`: Your Supabase project URL (https://cjpaohxjmsucfizsqflq.supabase.co)
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for admin functions)
- `JWT_SECRET`: Legacy JWT secret for authentication
- `POLLINATIONS_API_KEY`: API key for pollinations services
- `PORT`: Port to run the server on (defaults to 3001)

## API Endpoints

- `GET /` - Health check
- `GET /health` - Health check with status
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/users/profile` - Get authenticated user profile

## Deployment

This service is designed to be deployed on Render using the `render.yaml` configuration file.