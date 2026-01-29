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
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
PORT=3001
```

3. Start the development server:
```bash
npm run dev
```

## Environment Variables

- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY`: Your Supabase service role key (for admin functions)
- `PORT`: Port to run the server on (defaults to 3001)

## API Endpoints

- `GET /` - Health check
- `GET /health` - Health check with status
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login a user
- `GET /api/users/profile` - Get authenticated user profile

## Deployment

This service is designed to be deployed on Render using the `render.yaml` configuration file.