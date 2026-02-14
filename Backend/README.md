# OfficeOrbit Backend

Supabase-powered backend for user profiles and attendance tracking.

## Structure

```
Backend/
├── supabase/
│   ├── migrations/     # Database schema migrations
│   ├── functions/      # Edge Functions (serverless)
│   └── seed.sql        # Initial data
├── docs/
│   └── api.md          # API documentation
└── .env                # Environment variables
```

## Setup

1. Install Supabase CLI:
   ```bash
   npm install -g supabase
   ```

2. Login to Supabase:
   ```bash
   supabase login
   ```

3. Link to your project:
   ```bash
   supabase link --project-ref YOUR_PROJECT_ID
   ```

4. Run migrations:
   ```bash
   supabase db push
   ```
