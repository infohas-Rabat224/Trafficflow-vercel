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

// Fetch emails via IMAP
async function fetchIMAPEmails(config: IMAPEmailConfig, folder: string = 'INBOX'): Promise<{ success: boolean; emails?: Email[]; error?: string }> {
  try {
    const Imap = await import('imap').then(m => m.default || m);
    
    return new Promise((resolve) => {
      const imap = new Imap({
        user: config.username,
        password: config.password,
        host: config.host,
        port: config.port,
        tls: config.tls,
        tlsOptions: { rejectUnauthorized: false }
      });
      
      const emails: Email[] = [];
      
      imap.once('ready', () => {
        imap.openBox(folder, false, (err: Error | null, box: any) => {
          if (err) {
            imap.end();
            resolve({ success: false, error: err.message });
            return;
          }
          
          if (box.messages.total === 0) {
            imap.end();
            resolve({ success: true, emails: [] });
            return;
          }
          
          const fetch = imap.seq.fetch('1:10', {
            bodies: 'HEADER.FIELDS (FROM TO SUBJECT DATE)',
            struct: true
          });
          
          fetch.on('message', (msg: any, seqno: number) => {
            let email: Partial<Email> = { id: generateEmailId(), read: true, starred: false };
            
            msg.on('body', (stream: any, info: any) => {
              let buffer = '';
              stream.on('data', (chunk: string) => buffer += chunk);
              stream.once('end', () => {
                const fromMatch = buffer.match(/From: (.+)/i);
                const toMatch = buffer.match(/To: (.+)/i);
                const subjectMatch = buffer.match(/Subject: (.+)/i);
                const dateMatch = buffer.match(/Date: (.+)/i);
                
                if (fromMatch) {
                  const fromParts = fromMatch[1].match(/(.+) <(.+)>/) || ['', fromMatch[1], fromMatch[1]];
                  email.from = fromParts[1].replace(/"/g, '').trim();
                  email.fromEmail = fromParts[2];
                }
                if (toMatch) email.toEmail = toMatch[1];
                if (subjectMatch) email.subject = subjectMatch[1];
                if (dateMatch) email.date = dateMatch[1];
              });
            });
            
            msg.once('end', () => {
              emails.push(email as Email);
            });
          });
          
          fetch.once('error', (err: Error) => {
            imap.end();
            resolve({ success: false, error: err.message });
          });
          
          fetch.once('end', () => {
            imap.end();
          });
        });
      });
      
      imap.once('error', (err: Error) => {
        resolve({ success: false, error: `IMAP connection failed: ${err.message}` });
      });
      
      imap.once('end', () => {
        resolve({ success: true, emails });
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
      case 'fetch':
        if (!config?.imap?.host || !config?.imap?.username || !config?.imap?.password) {
          return NextResponse.json({
            success: false,
            error: 'IMAP configuration required. Configure IMAP settings in email configuration.',
            emails: [],
            requiresConfig: true
          });
        }
        
        const result = await fetchIMAPEmails(config.imap, folder || 'INBOX');
        
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
