import { NextResponse, NextRequest } from "next/server";

/**
 * Email Inbox API
 * 
 * Handles email operations like fetching, deleting, moving, etc.
 * Supports both IMAP and POP3 for receiving emails.
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

// POP3 configuration interface
interface POP3EmailConfig {
  host: string;
  port: number;
  username: string;
  password: string;
  tls: boolean;
}

// In-memory email storage (persists per server instance)
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

// Parse email address from header
function parseEmailAddress(header: string): { name: string; email: string } {
  if (!header) return { name: '', email: '' };
  
  // Try to match "Name <email@domain.com>" format
  const match = header.match(/(?:"?([^"]*)"?\s)?<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/i);
  if (match) {
    return {
      name: match[1]?.trim() || match[2],
      email: match[2]
    };
  }
  
  // Just an email address
  const emailMatch = header.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i);
  if (emailMatch) {
    return { name: emailMatch[1], email: emailMatch[1] };
  }
  
  return { name: header, email: header };
}

// Decode MIME encoded words (like =?UTF-8?B?...?=)
function decodeMimeWord(str: string): string {
  if (!str) return '';
  
  // Decode UTF-8 base64 encoded subjects
  return str.replace(/=\?UTF-8\?B\?([A-Za-z0-9+/=]+)\?=/gi, (_, base64) => {
    try {
      return Buffer.from(base64, 'base64').toString('utf-8');
    } catch {
      return base64;
    }
  }).replace(/=\?UTF-8\?Q\?([^?]+)\?=/gi, (_, quoted) => {
    try {
      return quoted.replace(/=([0-9A-F]{2})/gi, (_, hex) => 
        String.fromCharCode(parseInt(hex, 16))
      );
    } catch {
      return quoted;
    }
  });
}

// Fetch emails via IMAP with improved error handling
async function fetchIMAPEmails(config: IMAPEmailConfig, folder: string = 'INBOX'): Promise<{ success: boolean; emails?: Email[]; error?: string; debug?: string }> {
  let debugLog: string[] = [];
  
  try {
    debugLog.push(`Starting IMAP connection to ${config.host}:${config.port}`);
    
    const Imap = await import('imap').then(m => m.default || m);
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        debugLog.push('Connection timeout after 20 seconds');
        resolve({ 
          success: false, 
          error: 'Connection timeout - IMAP server did not respond within 20 seconds.',
          debug: debugLog.join('\n')
        });
      }, 20000);
      
      const imapConfig: any = {
        user: config.username,
        password: config.password,
        host: config.host,
        port: config.port,
        connTimeout: 15000,
        authTimeout: 15000
      };
      
      // Configure TLS/SSL
      if (config.tls) {
        imapConfig.tls = true;
        imapConfig.tlsOptions = { 
          rejectUnauthorized: false,
          servername: config.host
        };
      }
      
      debugLog.push(`IMAP config: ${JSON.stringify({...imapConfig, password: '***'})}`);
      
      const imap = new Imap(imapConfig);
      const emails: Email[] = [];
      let resolved = false;
      
      const cleanup = () => {
        clearTimeout(timeout);
        try { imap.destroy(); } catch (e) { debugLog.push(`Destroy error: ${e}`); }
      };
      
      imap.once('ready', () => {
        debugLog.push('IMAP connection ready');
        
        imap.openBox(folder, true, (err: Error | null, box: any) => {
          if (err) {
            debugLog.push(`Failed to open folder: ${err.message}`);
            cleanup();
            if (!resolved) {
              resolved = true;
              resolve({ success: false, error: `Failed to open folder: ${err.message}`, debug: debugLog.join('\n') });
            }
            return;
          }
          
          debugLog.push(`Opened folder ${folder}, total messages: ${box.messages.total}`);
          
          if (box.messages.total === 0) {
            debugLog.push('No messages in folder');
            cleanup();
            if (!resolved) {
              resolved = true;
              resolve({ success: true, emails: [], debug: debugLog.join('\n') });
            }
            return;
          }
          
          // Fetch last 20 emails with full bodies
          const start = Math.max(1, box.messages.total - 19);
          debugLog.push(`Fetching messages ${start} to ${box.messages.total}`);
          
          const fetch = imap.seq.fetch(`${start}:${box.messages.total}`, {
            bodies: ['', 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)', 'TEXT'],
            struct: true,
            markSeen: false
          });
          
          fetch.on('message', (msg: any, seqno: number) => {
            let email: Partial<Email> = { 
              id: generateEmailId(), 
              read: false, 
              starred: false, 
              body: '',
              subject: '(No Subject)',
              from: 'Unknown',
              fromEmail: '',
              date: new Date().toISOString()
            };
            let headers: any = {};
            let bodyParts: string[] = [];
            
            msg.on('body', (stream: any, info: any) => {
              let buffer = '';
              
              stream.on('data', (chunk: Buffer) => {
                buffer += chunk.toString('utf-8');
              });
              
              stream.once('end', () => {
                if (info.which === 'HEADER.FIELDS (FROM TO SUBJECT DATE MESSAGE-ID)') {
                  // Parse headers
                  const lines = buffer.split('\r\n');
                  let currentHeader = '';
                  let currentValue = '';
                  
                  lines.forEach(line => {
                    const headerMatch = line.match(/^([A-Z-]+):\s*(.*)$/i);
                    if (headerMatch) {
                      if (currentHeader) {
                        headers[currentHeader.toLowerCase()] = currentValue.trim();
                      }
                      currentHeader = headerMatch[1];
                      currentValue = headerMatch[2];
                    } else if (line.startsWith(' ') || line.startsWith('\t')) {
                      currentValue += ' ' + line.trim();
                    }
                  });
                  
                  if (currentHeader) {
                    headers[currentHeader.toLowerCase()] = currentValue.trim();
                  }
                } else if (info.which === 'TEXT') {
                  bodyParts.push(buffer);
                } else if (info.which === '') {
                  // Full body - try to extract text
                  bodyParts.push(buffer);
                }
              });
            });
            
            msg.once('attributes', (attrs: any) => {
              // Check if email is seen
              if (attrs.flags && attrs.flags.includes('\\Seen')) {
                email.read = true;
              }
            });
            
            msg.once('end', () => {
              // Process headers
              if (headers.from) {
                const parsed = parseEmailAddress(headers.from);
                email.from = decodeMimeWord(parsed.name) || parsed.email;
                email.fromEmail = parsed.email;
              }
              
              if (headers.to) {
                email.toEmail = headers.to;
              }
              
              if (headers.subject) {
                email.subject = decodeMimeWord(headers.subject) || '(No Subject)';
              }
              
              if (headers.date) {
                try {
                  email.date = new Date(headers.date).toISOString();
                } catch {
                  email.date = headers.date;
                }
              }
              
              if (headers['message-id']) {
                email.id = headers['message-id'].replace(/[<>]/g, '');
              }
              
              // Process body
              let fullBody = bodyParts.join('\n');
              // Clean up body - remove HTML tags if present, get plain text
              fullBody = fullBody
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/=\r\n/g, '') // Remove quoted-printable line breaks
                .replace(/=([0-9A-F]{2})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))) // Decode quoted-printable
                .substring(0, 2000); // Limit body size
              
              email.body = fullBody.trim() || '(No content)';
              
              if (email.subject || email.fromEmail) {
                emails.push(email as Email);
              }
              
              debugLog.push(`Processed message ${seqno}: ${email.subject}`);
            });
          });
          
          fetch.once('error', (err: Error) => {
            debugLog.push(`Fetch error: ${err.message}`);
            cleanup();
            if (!resolved) {
              resolved = true;
              resolve({ success: false, error: `Fetch error: ${err.message}`, debug: debugLog.join('\n') });
            }
          });
          
          fetch.once('end', () => {
            debugLog.push(`Fetch complete, got ${emails.length} emails`);
            imap.end();
          });
        });
      });
      
      imap.once('error', (err: Error) => {
        debugLog.push(`IMAP error: ${err.message}`);
        cleanup();
        if (!resolved) {
          resolved = true;
          
          let errorMsg = err.message;
          if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNREFUSED')) {
            errorMsg = `Cannot connect to ${config.host}:${config.port}. Check server address, port, and firewall.`;
          } else if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Authentication failed') || errorMsg.includes('Logon failure')) {
            errorMsg = 'Authentication failed. Check username and password.';
          } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS') || errorMsg.includes('certificate')) {
            errorMsg = 'SSL/TLS error. Try toggling SSL or check port (993 for SSL, 143 for StartTLS).';
          } else if (errorMsg.includes('Too many')) {
            errorMsg = 'Too many connections. Wait a moment and try again.';
          }
          
          resolve({ success: false, error: errorMsg, debug: debugLog.join('\n') });
        }
      });
      
      imap.once('end', () => {
        debugLog.push('IMAP connection ended');
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve({ success: true, emails, debug: debugLog.join('\n') });
        }
      });
      
      imap.connect();
    });
  } catch (error: any) {
    debugLog.push(`Exception: ${error.message}`);
    return { success: false, error: error.message, debug: debugLog.join('\n') };
  }
}

// Fetch emails via POP3
async function fetchPOP3Emails(config: POP3EmailConfig): Promise<{ success: boolean; emails?: Email[]; error?: string; debug?: string }> {
  let debugLog: string[] = [];
  
  try {
    debugLog.push(`Starting POP3 connection to ${config.host}:${config.port}`);
    
    // POP3 implementation using net socket
    const net = await import('net');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        debugLog.push('Connection timeout after 20 seconds');
        resolve({ 
          success: false, 
          error: 'Connection timeout - POP3 server did not respond within 20 seconds.',
          debug: debugLog.join('\n')
        });
      }, 20000);
      
      const socket = new net.Socket();
      let emails: Email[] = [];
      let currentStep = 'connect';
      let emailList: { num: number; size: number }[] = [];
      let currentEmail: Partial<Email> | null = null;
      let emailBuffer = '';
      
      const sendCommand = (cmd: string) => {
        debugLog.push(`SEND: ${cmd}`);
        socket.write(cmd + '\r\n');
      };
      
      socket.on('data', (data: Buffer) => {
        const response = data.toString();
        debugLog.push(`RECV: ${response.substring(0, 200)}...`);
        
        if (currentStep === 'connect') {
          // Wait for server greeting
          if (response.startsWith('+OK')) {
            currentStep = 'user';
            sendCommand(`USER ${config.username}`);
          } else {
            clearTimeout(timeout);
            resolve({ success: false, error: 'Server greeting failed', debug: debugLog.join('\n') });
          }
        } else if (currentStep === 'user') {
          if (response.startsWith('+OK')) {
            currentStep = 'pass';
            sendCommand(`PASS ${config.password}`);
          } else {
            clearTimeout(timeout);
            resolve({ success: false, error: 'Username rejected', debug: debugLog.join('\n') });
          }
        } else if (currentStep === 'pass') {
          if (response.startsWith('+OK')) {
            currentStep = 'list';
            sendCommand('LIST');
          } else {
            clearTimeout(timeout);
            resolve({ success: false, error: 'Authentication failed. Check username and password.', debug: debugLog.join('\n') });
          }
        } else if (currentStep === 'list') {
          if (response.includes('.')) {
            // Parse email list
            const lines = response.split('\r\n');
            lines.forEach(line => {
              const match = line.match(/^(\d+)\s+(\d+)$/);
              if (match) {
                emailList.push({ num: parseInt(match[1]), size: parseInt(match[2]) });
              }
            });
            
            debugLog.push(`Found ${emailList.length} emails`);
            
            if (emailList.length === 0) {
              sendCommand('QUIT');
              clearTimeout(timeout);
              resolve({ success: true, emails: [], debug: debugLog.join('\n') });
              return;
            }
            
            // Fetch emails (last 10)
            const toFetch = emailList.slice(-10);
            currentStep = 'retr';
            currentEmail = { id: generateEmailId(), read: true, starred: false, body: '' };
            sendCommand(`RETR ${toFetch[0].num}`);
          }
        } else if (currentStep === 'retr') {
          if (response.includes('\r\n.\r\n') || response.endsWith('\r\n.\r\n')) {
            // Email complete
            emailBuffer += response;
            
            // Parse email
            const headerMatch = emailBuffer.match(/^(.*?)\r\n\r\n/s);
            if (headerMatch) {
              const headers = headerMatch[1];
              
              const fromMatch = headers.match(/From:\s*(.+)/i);
              const subjectMatch = headers.match(/Subject:\s*(.+)/i);
              const dateMatch = headers.match(/Date:\s*(.+)/i);
              
              if (fromMatch) {
                const parsed = parseEmailAddress(fromMatch[1]);
                currentEmail!.from = decodeMimeWord(parsed.name) || parsed.email;
                currentEmail!.fromEmail = parsed.email;
              }
              
              if (subjectMatch) {
                currentEmail!.subject = decodeMimeWord(subjectMatch[1]) || '(No Subject)';
              }
              
              if (dateMatch) {
                try {
                  currentEmail!.date = new Date(dateMatch[1]).toISOString();
                } catch {
                  currentEmail!.date = dateMatch[1];
                }
              }
            }
            
            // Extract body
            const bodyMatch = emailBuffer.match(/\r\n\r\n([\s\S]*?)\r\n\.\r\n/);
            if (bodyMatch) {
              currentEmail!.body = bodyMatch[1]
                .replace(/<[^>]*>/g, '')
                .replace(/=\r\n/g, '')
                .substring(0, 1000);
            }
            
            if (currentEmail!.subject || currentEmail!.fromEmail) {
              emails.push(currentEmail as Email);
            }
            
            // Move to next email or quit
            const fetched = emails.length;
            const toFetch = emailList.slice(-10);
            
            if (fetched < toFetch.length) {
              currentEmail = { id: generateEmailId(), read: true, starred: false, body: '' };
              emailBuffer = '';
              sendCommand(`RETR ${toFetch[fetched].num}`);
            } else {
              sendCommand('QUIT');
              clearTimeout(timeout);
              resolve({ success: true, emails, debug: debugLog.join('\n') });
            }
          } else {
            emailBuffer += response;
          }
        }
      });
      
      socket.on('error', (err: Error) => {
        debugLog.push(`Socket error: ${err.message}`);
        clearTimeout(timeout);
        resolve({ success: false, error: `Connection error: ${err.message}`, debug: debugLog.join('\n') });
      });
      
      socket.on('close', () => {
        debugLog.push('Connection closed');
        clearTimeout(timeout);
      });
      
      socket.connect({
        host: config.host,
        port: config.port
      });
    });
  } catch (error: any) {
    debugLog.push(`Exception: ${error.message}`);
    return { success: false, error: error.message, debug: debugLog.join('\n') };
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
          error: 'Connection timeout - IMAP server did not respond within 15 seconds' 
        });
      }, 15000);
      
      const imapConfig: any = {
        user: config.username,
        password: config.password,
        host: config.host,
        port: config.port,
        connTimeout: 12000,
        authTimeout: 12000
      };
      
      if (config.tls) {
        imapConfig.tls = true;
        imapConfig.tlsOptions = { rejectUnauthorized: false };
      }
      
      const imap = new Imap(imapConfig);
      let resolved = false;
      
      imap.once('ready', () => {
        clearTimeout(timeout);
        imap.end();
        if (!resolved) {
          resolved = true;
          resolve({ 
            success: true, 
            message: `✅ Connected to IMAP server ${config.host}:${config.port}` 
          });
        }
      });
      
      imap.once('error', (err: Error) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          
          let errorMsg = err.message;
          if (errorMsg.includes('ETIMEDOUT') || errorMsg.includes('ECONNREFUSED')) {
            errorMsg = `Cannot connect to ${config.host}:${config.port}. Check address and port.`;
          } else if (errorMsg.includes('Invalid credentials') || errorMsg.includes('Authentication failed') || errorMsg.includes('Logon failure')) {
            errorMsg = 'Authentication failed. Check username and password.';
          } else if (errorMsg.includes('SSL') || errorMsg.includes('TLS')) {
            errorMsg = 'SSL/TLS error. Try toggling SSL or check port (993 for SSL).';
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

// Test POP3 connection
async function testPOP3Connection(config: POP3EmailConfig): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const net = await import('net');
    
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ 
          success: false, 
          error: 'Connection timeout - POP3 server did not respond within 15 seconds' 
        });
      }, 15000);
      
      const socket = new net.Socket();
      let resolved = false;
      let step = 'connect';
      
      socket.on('data', (data: Buffer) => {
        const response = data.toString();
        
        if (step === 'connect' && response.startsWith('+OK')) {
          step = 'user';
          socket.write(`USER ${config.username}\r\n`);
        } else if (step === 'user' && response.startsWith('+OK')) {
          step = 'pass';
          socket.write(`PASS ${config.password}\r\n`);
        } else if (step === 'pass' && response.startsWith('+OK')) {
          socket.write('QUIT\r\n');
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve({ 
              success: true, 
              message: `✅ Connected to POP3 server ${config.host}:${config.port}` 
            });
          }
        } else if (response.startsWith('-ERR')) {
          clearTimeout(timeout);
          if (!resolved) {
            resolved = true;
            resolve({ success: false, error: 'Authentication failed. Check username and password.' });
          }
        }
      });
      
      socket.on('error', (err: Error) => {
        clearTimeout(timeout);
        if (!resolved) {
          resolved = true;
          resolve({ success: false, error: `Connection error: ${err.message}` });
        }
      });
      
      socket.connect({
        host: config.host,
        port: config.port
      });
    });
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, config, emailId, folder, email, targetFolder, protocol } = body;
    
    switch (action) {
      case 'test_imap':
        if (!config?.imap?.host) {
          return NextResponse.json({ success: false, error: 'IMAP host is required' });
        }
        if (!config?.imap?.username) {
          return NextResponse.json({ success: false, error: 'IMAP username is required' });
        }
        if (!config?.imap?.password) {
          return NextResponse.json({ success: false, error: 'IMAP password is required' });
        }
        
        const imapTestResult = await testIMAPConnection({
          host: config.imap.host,
          port: config.imap.port || 993,
          username: config.imap.username,
          password: config.imap.password,
          tls: config.imap.useSSL !== false
        });
        
        return NextResponse.json(imapTestResult);
        
      case 'test_pop':
        if (!config?.pop?.host) {
          return NextResponse.json({ success: false, error: 'POP3 host is required' });
        }
        if (!config?.pop?.username) {
          return NextResponse.json({ success: false, error: 'POP3 username is required' });
        }
        if (!config?.pop?.password) {
          return NextResponse.json({ success: false, error: 'POP3 password is required' });
        }
        
        const popTestResult = await testPOP3Connection({
          host: config.pop.host,
          port: config.pop.port || 995,
          username: config.pop.username,
          password: config.pop.password,
          tls: config.pop.useSSL !== false
        });
        
        return NextResponse.json(popTestResult);
        
      case 'fetch':
        // Determine which protocol to use
        const useIMAP = protocol === 'imap' || (config?.imap?.host && !config?.pop?.host);
        const usePOP = protocol === 'pop' || config?.pop?.host;
        
        if (useIMAP && config?.imap?.host) {
          if (!config.imap.username || !config.imap.password) {
            return NextResponse.json({
              success: false,
              error: 'IMAP username and password required',
              emails: []
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
            // Reverse to show newest first
            const emails = (result.emails || []).reverse();
            emailStore.inbox = emails;
            
            return NextResponse.json({
              success: true,
              emails,
              folder: 'inbox',
              message: `Fetched ${emails.length} emails via IMAP`,
              debug: result.debug
            });
          } else {
            return NextResponse.json({
              success: false,
              error: result.error,
              emails: [],
              debug: result.debug
            });
          }
        } else if (usePOP && config?.pop?.host) {
          if (!config.pop.username || !config.pop.password) {
            return NextResponse.json({
              success: false,
              error: 'POP3 username and password required',
              emails: []
            });
          }
          
          const result = await fetchPOP3Emails({
            host: config.pop.host,
            port: config.pop.port || 995,
            username: config.pop.username,
            password: config.pop.password,
            tls: config.pop.useSSL !== false
          });
          
          if (result.success) {
            const emails = (result.emails || []).reverse();
            emailStore.inbox = emails;
            
            return NextResponse.json({
              success: true,
              emails,
              folder: 'inbox',
              message: `Fetched ${emails.length} emails via POP3`,
              debug: result.debug
            });
          } else {
            return NextResponse.json({
              success: false,
              error: result.error,
              emails: [],
              debug: result.debug
            });
          }
        } else {
          return NextResponse.json({
            success: false,
            error: 'Configure IMAP or POP3 settings to fetch emails',
            emails: [],
            requiresConfig: true
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
