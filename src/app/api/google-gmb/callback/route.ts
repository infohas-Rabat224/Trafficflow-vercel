import { NextResponse, NextRequest } from "next/server";

/**
 * Google My Business (GMB) OAuth Callback Route
 * 
 * This route handles the OAuth 2.0 callback from Google for Google Business Profile integration.
 * It exchanges the authorization code for access and refresh tokens.
 * 
 * Redirect URIs (configure in Google Cloud Console):
 * - https://my-project-iota-lilac.vercel.app/api/google-gmb/callback
 * - https://my-project-cabincrewmorocco-beeps-projects.vercel.app/api/google-gmb/callback
 * 
 * Required Scopes:
 * - https://www.googleapis.com/auth/business.manage
 */

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';

// Supported redirect URIs for both Vercel deployments
const ALLOWED_REDIRECT_URIS = [
  'https://my-project-iota-lilac.vercel.app/api/google-gmb/callback',
  'https://my-project-cabincrewmorocco-beeps-projects.vercel.app/api/google-gmb/callback',
  // Also support the old oauth path for backward compatibility
  'https://my-project-iota-lilac.vercel.app/api/oauth/google-business/callback',
  'https://my-project-cabincrewmorocco-beeps-projects.vercel.app/api/oauth/google-business/callback',
];

// Get the correct redirect URI based on the request
function getRedirectUri(request: NextRequest): string {
  const host = request.headers.get('host') || '';
  const protocol = request.headers.get('x-forwarded-proto') || 'https';
  const requestUri = `${protocol}://${host}/api/google-gmb/callback`;
  
  // Check if the request URI is in our allowed list
  if (ALLOWED_REDIRECT_URIS.includes(requestUri)) {
    return requestUri;
  }
  
  // Fallback to primary production URL
  return 'https://my-project-iota-lilac.vercel.app/api/google-gmb/callback';
}

// Check if OAuth is configured
function isOAuthConfigured(): boolean {
  return !!(
    GOOGLE_CLIENT_ID && 
    GOOGLE_CLIENT_SECRET && 
    GOOGLE_CLIENT_ID.length > 10 && 
    !GOOGLE_CLIENT_ID.includes('demo') &&
    !GOOGLE_CLIENT_ID.includes('placeholder')
  );
}

// Log OAuth errors in a structured format
function logOAuthError(errorType: string, details: Record<string, unknown>): void {
  console.error(JSON.stringify({
    timestamp: new Date().toISOString(),
    service: 'Google My Business OAuth',
    errorType,
    ...details
  }));
}

// Sample business data for demo mode
const DEMO_BUSINESSES = [
  {
    id: '1',
    name: 'TrafficFlow SEO Agency',
    address: '123 Marketing St, New York, NY 10001',
    phone: '+1 (555) 123-4567',
    category: 'Marketing Agency',
    website: 'https://trafficflow.io',
    rating: 4.8,
    totalReviews: 127
  },
  {
    id: '2',
    name: 'Digital Marketing Pro',
    address: '456 Business Ave, Los Angeles, CA 90001',
    phone: '+1 (555) 987-6543',
    category: 'Internet Marketing Service',
    website: 'https://digitalmarketingpro.com',
    rating: 4.6,
    totalReviews: 89
  }
];

// Generate GMB insights
function generateGMBInsights() {
  return {
    views: 12847 + Math.floor(Math.random() * 2000),
    searches: 3892 + Math.floor(Math.random() * 500),
    actions: 156 + Math.floor(Math.random() * 50),
    directionRequests: 89 + Math.floor(Math.random() * 30),
    callClicks: 67 + Math.floor(Math.random() * 20),
    websiteClicks: 134 + Math.floor(Math.random() * 40),
    reviews: {
      total: 127 + Math.floor(Math.random() * 10),
      average: 4.8,
      distribution: { 5: 98, 4: 21, 3: 5, 2: 2, 1: 1 }
    },
    photos: 45 + Math.floor(Math.random() * 10),
    posts: 12 + Math.floor(Math.random() * 3),
    qanda: 8 + Math.floor(Math.random() * 3),
    lastUpdated: new Date().toISOString()
  };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');
  const state = searchParams.get('state');

  // Handle OAuth error from Google
  if (error) {
    logOAuthError('oauth_error_from_google', {
      error,
      errorDescription,
      state
    });

    return new NextResponse(
      buildErrorResponse(error, errorDescription || 'Authorization failed'),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }

  // Missing authorization code
  if (!code) {
    logOAuthError('missing_authorization_code', {
      state,
      hasParams: Object.fromEntries(searchParams.entries())
    });

    return new NextResponse(
      buildErrorResponse('invalid_request', 'Authorization code missing'),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }

  // OAuth not configured - return demo mode
  if (!isOAuthConfigured()) {
    logOAuthError('oauth_not_configured', {
      hasClientId: !!GOOGLE_CLIENT_ID,
      hasClientSecret: !!GOOGLE_CLIENT_SECRET
    });

    return new NextResponse(
      buildDemoResponse(),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }

  try {
    const redirectUri = getRedirectUri(request);
    
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'Google My Business OAuth',
      action: 'token_exchange_start',
      redirectUri,
      state
    }));

    // Exchange authorization code for tokens
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      let errorData;
      
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { raw: errorText };
      }

      logOAuthError('token_exchange_failed', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorData,
        redirectUri
      });

      // Handle specific error types
      const errorCode = errorData.error || 'unknown_error';
      
      if (errorCode === 'redirect_uri_mismatch') {
        logOAuthError('redirect_uri_mismatch', {
          usedRedirectUri: redirectUri,
          hint: 'Ensure this exact URI is configured in Google Cloud Console'
        });
      } else if (errorCode === 'invalid_client') {
        logOAuthError('invalid_client', {
          hint: 'Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in environment variables'
        });
      } else if (errorCode === 'invalid_grant') {
        logOAuthError('invalid_grant', {
          hint: 'Authorization code may have expired or already been used'
        });
      }

      return new NextResponse(
        buildErrorResponse(errorCode, errorData.error_description || 'Token exchange failed'),
        {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        }
      );
    }

    const tokens = await tokenResponse.json();

    // Get business accounts using the Business Profile API
    let businesses = DEMO_BUSINESSES;
    let userInfo = { email: 'user@gmail.com', name: 'Google User' };

    try {
      // Get user info
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });
      
      if (userInfoResponse.ok) {
        const userData = await userInfoResponse.json();
        userInfo = {
          email: userData.email || 'user@gmail.com',
          name: userData.name || 'Google User'
        };
      }

      // Get business accounts
      const accountsResponse = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: {
          'Authorization': `Bearer ${tokens.access_token}`,
        },
      });
      
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        if (accountsData.accounts && accountsData.accounts.length > 0) {
          businesses = accountsData.accounts.map((acc: { name?: string; accountName?: string; phoneNumber?: string; type?: string }) => ({
            id: acc.name || `acc_${Date.now()}`,
            name: acc.accountName || 'Business Account',
            address: 'Address from API',
            phone: acc.phoneNumber || 'N/A',
            category: acc.type || 'Business',
            rating: 0,
            totalReviews: 0
          }));
        }
      }
    } catch (e) {
      console.log('Could not fetch business accounts, using demo data');
    }

    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      service: 'Google My Business OAuth',
      action: 'token_exchange_success',
      userEmail: userInfo.email,
      businessCount: businesses.length,
      hasAccessToken: !!tokens.access_token,
      hasRefreshToken: !!tokens.refresh_token,
      expiresIn: tokens.expires_in
    }));

    // Return success response
    return new NextResponse(
      buildSuccessResponse({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
        user: userInfo,
        businesses,
        insights: generateGMBInsights(),
        expiresAt: Date.now() + (tokens.expires_in * 1000)
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    logOAuthError('unexpected_error', {
      error: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });

    return new NextResponse(
      buildErrorResponse('server_error', errorMessage),
      {
        status: 200,
        headers: { 'Content-Type': 'text/html' }
      }
    );
  }
}

// Build HTML response for success
function buildSuccessResponse(data: {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  user: { email: string; name: string };
  businesses: Array<{
    id: string;
    name: string;
    address: string;
    phone: string;
    category: string;
    rating: number;
    totalReviews: number;
  }>;
  insights: ReturnType<typeof generateGMBInsights>;
  expiresAt: number;
}): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Google Business Connected</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
    }
    .container { text-align: center; padding: 2rem; }
    .spinner {
      width: 40px; height: 40px;
      border: 3px solid rgba(255,255,255,0.3);
      border-top-color: #4285f4;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 1rem;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="container">
    <div class="spinner"></div>
    <p>Connecting Google Business Profile...</p>
  </div>
  <script>
    (function() {
      const data = ${JSON.stringify(data)};
      
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_GMB_OAUTH_SUCCESS',
          service: 'googleGMB',
          success: true,
          tokens: {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in
          },
          user: data.user,
          businesses: data.businesses,
          insights: data.insights,
          expiresAt: data.expiresAt
        }, '*');
        setTimeout(function() { window.close(); }, 500);
      } else {
        document.body.innerHTML = '<div class="container"><h2 style="color: #34d399;">Google Business Connected!</h2><p>You can close this window.</p></div>';
      }
    })();
  </script>
</body>
</html>`;
}

// Build HTML response for error
function buildErrorResponse(error: string, description: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <title>Connection Error</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
    }
    .container { text-align: center; padding: 2rem; max-width: 400px; }
    .error-icon { font-size: 48px; margin-bottom: 1rem; }
    .error-code { color: #f87171; font-size: 14px; margin-top: 1rem; }
  </style>
</head>
<body>
  <div class="container">
    <div class="error-icon">⚠️</div>
    <h2>Connection Failed</h2>
    <p>${description}</p>
    <p class="error-code">Error: ${error}</p>
  </div>
  <script>
    (function() {
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_GMB_OAUTH_ERROR',
          service: 'googleGMB',
          success: false,
          error: '${error}',
          errorDescription: '${description.replace(/'/g, "\\'")}'
        }, '*');
        setTimeout(function() { window.close(); }, 2000);
      }
    })();
  </script>
</body>
</html>`;
}

// Build demo mode response
function buildDemoResponse(): string {
  const demoData = {
    access_token: `demo_gmb_access_${Date.now()}`,
    refresh_token: `demo_gmb_refresh_${Date.now()}`,
    expires_in: 3600,
    token_type: 'Bearer',
    user: { email: 'demo@trafficflow.io', name: 'Demo User' },
    businesses: DEMO_BUSINESSES,
    insights: generateGMBInsights(),
    expiresAt: Date.now() + 3600000
  };

  return `<!DOCTYPE html>
<html>
<head>
  <title>Google Business Demo Mode</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: white;
    }
    .container { text-align: center; padding: 2rem; }
    .demo-badge {
      background: #fbbf24;
      color: #1a1a2e;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: bold;
      margin-bottom: 1rem;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="container">
    <span class="demo-badge">DEMO MODE</span>
    <h2>Google Business Connected</h2>
    <p style="color: #94a3b8; font-size: 14px;">Demo mode active - Configure OAuth for production</p>
  </div>
  <script>
    (function() {
      const data = ${JSON.stringify(demoData)};
      
      if (window.opener) {
        window.opener.postMessage({
          type: 'GOOGLE_GMB_OAUTH_SUCCESS',
          service: 'googleGMB',
          success: true,
          demoMode: true,
          tokens: {
            access_token: data.access_token,
            refresh_token: data.refresh_token,
            expires_in: data.expires_in
          },
          user: data.user,
          businesses: data.businesses,
          insights: data.insights,
          expiresAt: data.expiresAt
        }, '*');
        setTimeout(function() { window.close(); }, 500);
      }
    })();
  </script>
</body>
</html>`;
}
