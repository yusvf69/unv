import { neon } from "@neondatabase/serverless";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.warn("DATABASE_URL is not set");
}

const sql = neon(DATABASE_URL || "");

// Simple response helper
function jsonResponse(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Home feed endpoint
async function handleHomeFeed() {
  try {
    // Get basic stats without complex queries
    const [students] = await sql`SELECT COUNT(*) as count FROM users WHERE role = 'student'`;
    const [staff] = await sql`SELECT COUNT(*) as count FROM users WHERE role IN ('doctor', 'ta')`;
    
    // Get latest news (limit to avoid timeout)
    const news = await sql`SELECT id, title, body, image_url, created_at FROM news ORDER BY created_at DESC LIMIT 5`;
    
    return jsonResponse({
      students: students.count,
      staff: staff.count,
      latestNews: news.map(n => ({
        ...n,
        createdAt: n.created_at
      }))
    });
  } catch (error) {
    console.error('Home feed error:', error);
    return jsonResponse({ error: 'Failed to load home feed' }, 500);
  }
}

// Me endpoint
async function handleMe(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    
    // For now, return a simple response without complex auth
    return jsonResponse({
      id: 1,
      name: 'Test User',
      username: 'testuser',
      email: 'test@example.com',
      role: 'student'
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    return jsonResponse({ error: 'Failed to get user info' }, 500);
  }
}

// Notifications endpoint
async function handleNotifications(request: Request) {
  try {
    // For now, return mock notifications
    return jsonResponse([
      {
        id: 1,
        title: 'Welcome!',
        body: 'Welcome to UniVerse',
        type: 'info',
        read: false,
        createdAt: new Date().toISOString()
      }
    ]);
  } catch (error) {
    console.error('Notifications error:', error);
    return jsonResponse({ error: 'Failed to load notifications' }, 500);
  }
}

// Health check
async function handleHealth() {
  return jsonResponse({ status: 'ok' });
}

// Main handler
export default async function handler(request: Request) {
  // Parse the URL properly, handling Vercel's routing
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    // If request.url is not a full URL, construct one
    const host = request.headers.get('host') || 'localhost';
    url = new URL(`https://${host}${request.url}`);
  }
  
  // Extract the path and handle Vercel's routing parameters
  let path = url.pathname.replace('/api', '');
  
  // Check for Vercel's catch-all routing parameter
  const routeParam = url.searchParams.get('[...route]');
  if (routeParam) {
    path = '/' + routeParam;
  }
  
  console.log('API Request:', path, 'Original URL:', request.url);
  
  try {
    switch (path) {
      case '/home/feed':
        if (request.method === 'GET') {
          return await handleHomeFeed();
        }
        break;
      
      case '/v2/me':
        if (request.method === 'GET') {
          return await handleMe(request);
        }
        break;
      
      case '/v2/notifications':
        if (request.method === 'GET') {
          return await handleNotifications(request);
        }
        break;
      
      case '/health':
      case '/healthz':
        return await handleHealth();
      
      default:
        return jsonResponse({ error: 'Not Found' }, 404);
    }
  } catch (error) {
    console.error('API Error:', error);
    return jsonResponse({ error: 'Internal Server Error' }, 500);
  }
  
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
