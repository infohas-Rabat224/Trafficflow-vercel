import { NextResponse, NextRequest } from "next/server";

/**
 * Email Inbox API
 * 
 * Handles email operations like fetching, deleting, moving, etc.
 * Uses IMAP for receiving emails (when configured).
 */

// Email interface
interface Email {
  id: string;
  from: string;
  fromEmail: string;
  to?: string;
  toEmail?: string;
  subject: string;
  body: string;
  date: string;
  read: boolean;
  starred: boolean;
  folder?: string;
  attachments?: { filename: string; size: number }[];
}

// IMAP configuration interface
interface IMAPEmailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}

// In-memory email storage (persists per server instance)
// In production, this would be a database
let emailStore: {
  inbox: Email[];
  sent: Email[];
  drafts: Email[];
  spam: Email[];
  trash: Email[];
} = {
  inbox: [],
  sent: [],
  drafts: [],
  spam: [],
  trash: []
};

// Generate unique email ID
function generateEmailId(): string {
  return `email_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

// Fetch emails via IMAP with timeout handling
async function fetchIMAPEmails(config: IMAPEmailConfig, folder: string = 'INBOX'): Promise<{ success: boolean; emails?: Email[]; error?: string }> {
  try {
    const Imap = await import('imap').then(m => m.default || m);
    
    return new Promise((resolve) => {
      // Create timeout to prevent hanging
      const timeout = setTimeout(() => {
        resolve({ 
          success: false, 
          error: 'Connection timeout - IMAP server did not respond within 15 seconds. Please check your server address, port, and firewall settings.' 
        });
      }, 15000);
      
      const imap = new Imap({
        user: config.username,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        tlsOptions: { 
          rejectUnauthorized: false,
          servername: config.host
        },
        connTimeout: 10000,  // 10 second connection timeout
        authTimeout: 10000   // 10 second auth timeout
      });
      
      const emails: Email[] = [];
      let resolved = false;
      
      const cleanup = () => {
        clearTimeout(timeout);
        try { imap.destroy(); } catch (e) { /* ignore */ }
      };
      
      imap.once('ready', () => {
        clearTimeout(timeout); // Clear timeout on successful connection
        
        imap.openBox(folder, false, (err: Error | null, box: any) => {
          if (err) {
            cleanup();
            if (!resolved) {
              resolved = true;
              resolve({ success: false, error: `Failed to open folder: ${err.message}` });
            }
            return;
          }
          
          if (box.messages.total === 0) {
            cleanup();
            if (!resolved) {
              resolved = true;
              resolve({ success: true, emails: [] });
            }
            return;
          }
          
          // Fetch last 20 emails
          const start = Math.max(1, box.messages.total - 19);
          const fetch = imap.seq.fetch(`${start}:${box.messages.total}`, {
            bodies: ['HEADER.FIELDS (FROM TO SUBJECT DATE)', 'TEXT'],
            struct: true
          });
          
          fetch.on('message', (msg: any, seqno: number) => {
            let email: Partial<Email> = { id: generateEmailId(), read: true, starred: false, body: '' };
            let headerBuffer = '';
            let bodyBuffer = '';
            
            msg.on('body', (stream: any, info: any) => {
              stream.on('data', (chunk: string) => {
                if (info.which === 'TEXT') {
                  bodyBuffer += chunk;
                } else {
                  headerBuffer += chunk;
                }
              });
              stream.once('end', () => {
                // Parse headers
                const fromMatch = headerBuffer.match(/From: (.+)/i);
                const toMatch = headerBuffer.match(/To: (.+)/i);
                const subjectMatch = headerBuffer.match(/Subject: (.+)/i);
                const dateMatch = headerBuffer.match(/Date: (.+)/i);
                
                if (fromMatch) {
                  const fromParts = fromMatch[1].match(/"?([^"]*)"? ?<(.+)>/) || ['', fromMatch[1].trim(), fromMatch[1].trim()];
                  email.from = fromParts[1].replace(/"/g, '').trim() || fromMatch[1].trim();
                  email.fromEmail = fromParts[2] || fromMatch[1].trim();
                }
                if (toMatch) email.toEmail = toMatch[1];
                if (subjectMatch) email.subject = subjectMatch[1].trim();
                if (dateMatch) email.date = dateMatch[1];
                
                // Set body (first 500 chars)
                email.body = bodyBuffer.substring(0, 500);
              });
            });
            
            msg.once('end', () => {
              if (email.subject || email.from) {
                emails.push(email as Email);
              }
            });
          });
          
          fetch.once('error', (err: Error) => {
            cleanup();
            if (!resolved) {
              resolved = true;
              resolve({ success: false, error: `Fetch error: ${err.message}` });
            }
          });
          
          fetch.once('end', () => {
            imap.end();
          });
        });
      });
      
      imap.once('error', (err: Error) => {
        cleanup();
        if (!resolved) {
          resolved = true;
          
          // Provide helpful error messages
          let errorMsg = err.message;
          if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNREFUSED')) {
            errorMsg = `Cannot connect to IMAP server at ${config.host}:${config.port}. Check server address and port, and ensure firewall allows the connection.`;
          } else if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Authentication failed')) {
            errorMsg = 'Authentication failed. Check your username and password.';
          } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
            errorMsg = 'SSL/TLS error. Try toggling the SSL setting or check if the port is correct (993 for SSL, 143 for non-SSL).';
          }
          
          resolve({ success: false, error: `IMAP connection failed: ${errorMsg}` });
        }
      });
      
      imap.once('end', () => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve({ success: true, emails });
        }
      });
      
      imap.connect();
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// Test IMAP connection
async function testIMAPConnection(config: IMAPEmailConfig): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const Imap = await import('imap').then(m => m.default || m);
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ 
          success: false, 
          error: 'Connection timeout - IMAP server did not respond within 10 seconds' 
        });
      }, 10000);
      
      const imap = new Imap({
        user: config.username,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        tlsOptions: { 
          rejectUnauthorized: false,
          servername: config.host
        },
        connTimeout: 8000,
        authTimeout: 8000
      });
      
      let resolved = false;
      
      imap.once('ready', () => {
        clearTimeout(timeout);
        imap.end();
        if (!resolved) {
          resolved = true;
          resolve({ 
            success: true, 
            message: `Successfully connected to IMAP server at ${config.host}:${config.port}` 
          });
        }
      });
      
      imap.once('error', (err: Error) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          
          let errorMsg = err.message;
          if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNREFUSED')) {
            errorMsg = `Cannot connect to ${config.host}:${config.port}. Check server address and port.`;
          } else if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Authentication failed')) {
            errorMsg = 'Authentication failed. Check username and password.';
          } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
            errorMsg = 'SSL/TLS error. Try toggling SSL or check port (993 for SSL, 143 for non-SSL).';
          }
          
          resolve({ success: false, error: errorMsg });
        }
      });
      
      imap.once('end', () => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve({ success: true, message: 'Connection test successful' });
        }
      });
      
      imap.connect();
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config, emailId, folder, email, targetFolder } = body;
    
    switch (action) {
      case 'test_imap':
        // Validate IMAP config
        if (!config?.imap?.host) {
          return NextResponse.json({
            success: false,
            error: 'IMAP host is required'
          });
        }
        if (!config?.imap?.username) {
          return NextResponse.json({
            success: false,
            error: 'IMAP username is required'
          });
        }
        if (!config?.imap?.password) {
          return NextResponse.json({
            success: false,
            error: 'IMAP password is required'
          });
        }
        
        const testResult = await testIMAPConnection({
          host: config.imap.host,
          port: config.imap.port || 993,
          username: config.imap.username,
          password: config.imap.password,
          tls: config.imap.useSSL !== false // Default to true
        });
        
        return NextResponse.json(testResult);
        
      case 'fetch':
        if (!config?.imap?.host || !config?.imap?.username || !config?.imap?.password) {
          return NextResponse.json({
            success: false,
            error: 'IMAP configuration required. Configure IMAP settings in email configuration.',
            emails: [],
            requiresConfig: true
          });
        }
        
        const result = await fetchIMAPEmails({
          host: config.imap.host,
          port: config.imap.port || 993,
          username: config.imap.username,
          password: config.imap.password,
          tls: config.imap.useSSL !== false
        }, folder || 'INBOX');
        
        if (result.success) {
          const target = folder === 'INBOX' ? 'inbox' : folder?.toLowerCase() || 'inbox';
          emailStore[target as keyof typeof emailStore] = result.emails || [];
          
          return NextResponse.json({
            success: true,
            emails: result.emails,
            folder: target,
            message: `Fetched ${result.emails?.length || 0} emails`
          });
        } else {
          return NextResponse.json({
            success: false,
            error: result.error,
            emails: []
          });
        }
        
      case 'delete':
        const sourceFolder = folder || 'inbox';
        const emailIndex = emailStore[sourceFolder as keyof typeof emailStore]?.findIndex((e: Email) => e.id === emailId);
        
        if (emailIndex === -1) {
          return NextResponse.json({ success: false, error: 'Email not found' });
        }
        
        if (sourceFolder === 'trash') {
          emailStore.trash.splice(emailIndex, 1);
        } else {
          const [deleted] = emailStore[sourceFolder as keyof typeof emailStore].splice(emailIndex, 1);
          deleted.folder = sourceFolder;
          emailStore.trash.unshift(deleted);
        }
        
        return NextResponse.json({
          success: true,
          message: sourceFolder === 'trash' ? 'Email permanently deleted' : 'Email moved to trash'
        });
        
      case 'move':
        const fromFolder = folder;
        const toFolder = targetFolder;
        const idx = emailStore[fromFolder as keyof typeof emailStore]?.findIndex((e: Email) => e.id === emailId);
        
        if (idx === -1) {
          return NextResponse.json({ success: false, error: 'Email not found' });
        }
        
        const [moved] = emailStore[fromFolder as keyof typeof emailStore].splice(idx, 1);
        emailStore[toFolder as keyof typeof emailStore].unshift(moved);
        
        return NextResponse.json({
          success: true,
          message: `Email moved to ${toFolder}`
        });
        
      case 'mark_read':
        const readIdx = emailStore[folder as keyof typeof emailStore]?.findIndex((e: Email) => e.id === emailId);
        if (readIdx !== -1) {
          (emailStore[folder as keyof typeof emailStore] as Email[])[readIdx].read = true;
        }
        return NextResponse.json({ success: true });
        
      case 'mark_unread':
        const unreadIdx = emailStore[folder as keyof typeof emailStore]?.findIndex((e: Email) => e.id === emailId);
        if (unreadIdx !== -1) {
          (emailStore[folder as keyof typeof emailStore] as Email[])[unreadIdx].read = false;
        }
        return NextResponse.json({ success: true });
        
      case 'star':
        const starIdx = emailStore[folder as keyof typeof emailStore]?.findIndex((e: Email) => e.id === emailId);
        if (starIdx !== -1) {
          const emailToStar = (emailStore[folder as keyof typeof emailStore] as Email[])[starIdx];
          emailToStar.starred = !emailToStar.starred;
        }
        return NextResponse.json({ success: true });
        
      case 'empty_folder':
        if (['spam', 'trash'].includes(folder)) {
          emailStore[folder as keyof typeof emailStore] = [];
          return NextResponse.json({
            success: true,
            message: `${folder} folder emptied`
          });
        }
        return NextResponse.json({ success: false, error: 'Can only empty spam or trash folders' });
        
      case 'save_draft':
        const draft: Email = {
          id: emailId || generateEmailId(),
          from: config?.fromName || 'Me',
          fromEmail: config?.fromEmail || '',
          to: email.to,
          toEmail: email.toEmail,
          subject: email.subject,
          body: email.body,
          date: new Date().toISOString(),
          read: true,
          starred: false
        };
        
        if (emailId) {
          const draftIdx = emailStore.drafts.findIndex(e => e.id === emailId);
          if (draftIdx !== -1) {
            emailStore.drafts[draftIdx] = draft;
          } else {
            emailStore.drafts.unshift(draft);
          }
        } else {
          emailStore.drafts.unshift(draft);
        }
        
        return NextResponse.json({
          success: true,
          draftId: draft.id,
          message: 'Draft saved'
        });
        
      case 'get_all':
        return NextResponse.json({
          success: true,
          folders: emailStore
        });
        
      default:
        return NextResponse.json({ success: false, error: 'Unknown action' });
    }
  } catch (error: any) {
    console.error('Email inbox API error:', error);
    return NextResponse.json({ success: false, error: error.message });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action');
  const folder = searchParams.get('folder') || 'inbox';
  
  if (action === 'status') {
    return NextResponse.json({
      success: true,
      emailCounts: {
        inbox: emailStore.inbox.length,
        sent: emailStore.sent.length,
        drafts: emailStore.drafts.length,
        spam: emailStore.spam.length,
        trash: emailStore.trash.length,
        unread: emailStore.inbox.filter(e => !e.read).length
      }
    });
  }
  
  if (action === 'folders') {
    return NextResponse.json({
      success: true,
      folders: emailStore
    });
  }
  
  return NextResponse.json({
    success: true,
    folder,
    emails: emailStore[folder as keyof typeof emailStore] || []
  });
}
