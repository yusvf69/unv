# UniVerse - University Platform

## Local Development

### 1. Install Dependencies
```bash
pnpm install
```

### 2. Set Up Database
Get a free PostgreSQL database from [Neon.tech](https://neon.tech):
1. Sign up at neon.tech (free)
2. Create a new project
3. Copy the connection string (looks like `postgresql://user:password@ep-xxxxx.us-east-2.aws.neon.tech/neondb?sslmode=require`)
4. Create `.env.local` in the root:
```
DATABASE_URL="your-connection-string-here"
```

### 3. Push Schema & Seed
```bash
# Push database schema
pnpm --filter @workspace/db run push

# Seed admin accounts
pnpm exec tsx artifacts/api-server/src/seed.ts
```

### 4. Run Dev Servers
```bash
bash scripts/dev.sh
```
- Frontend: `http://localhost:23974`
- API: `http://localhost:8080`

Or run separately:
```bash
# API server
PORT=8080 NODE_ENV=development pnpm --filter @workspace/api-server run dev

# Frontend (in another terminal)
PORT=23974 BASE_PATH=/ pnpm --filter @workspace/universe run dev
```

## Deploy to Vercel (Free)

### Prerequisites
1. Free Neon.tech PostgreSQL database (see step 2 above)
2. Vercel account (free)

### Steps

#### 1. Push your code to GitHub
```bash
git add .
git commit -m "Initial commit"
git push origin main
```

#### 2. Deploy on Vercel
1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "New Project"
3. Import your GitHub repository
4. Configure:
   - **Build Command**: `pnpm install && pnpm run build`
   - **Output Directory**: `artifacts/universe/dist/public`
   - **Install Command**: `pnpm install`
5. Add Environment Variable:
   - Name: `DATABASE_URL`
   - Value: Your Neon connection string
6. Click Deploy

#### 3. Run Database Migration
After first deployment, run:
```bash
# In the Vercel project dashboard, go to Settings > Environment Variables
# Make sure DATABASE_URL is set, then run locally:
DATABASE_URL="your-neon-url" pnpm --filter @workspace/db run push
pnpm exec tsx artifacts/api-server/src/seed.ts
```

### Admin Accounts (after seeding)
- **Super Admin**: khaled@uniagri.edu / SuperAdmin123!
- **Admin**: fatma@uniagri.edu / Admin123!

## Architecture

- **Frontend**: React + Vite + Tailwind CSS (TypeScript)
- **API**: Express 5 with Drizzle ORM
- **Database**: PostgreSQL (Neon free tier)
- **Auth**: Password-based with bcryptjs
- **Session**: Cookie-based

## Project Structure

```
├── api/                    # Vercel serverless functions
├── artifacts/
│   ├── api-server/         # Express API server
│   └── universe/           # React frontend
├── lib/
│   ├── db/                 # Drizzle ORM schema
│   ├── api-spec/           # OpenAPI spec
│   ├── api-client-react/   # Generated React hooks
│   └── api-zod/            # Zod validation schemas
└── scripts/                # Development scripts
```
