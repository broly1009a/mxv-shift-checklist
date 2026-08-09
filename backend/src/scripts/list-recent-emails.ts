import * as dotenv from 'dotenv';
dotenv.config();

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { EmailWatcherService } from '../modules/bot-engine/email-watcher.service';

async function run() {
  console.log('🚀 Booting NestJS Application Context to fetch last 15 emails...');
  const appContext = await NestFactory.createApplicationContext(AppModule);
  const emailWatcher = appContext.get(EmailWatcherService);

  try {
    const clientId = process.env.MICROSOFT_CLIENT_ID || '';
    const clientSecret = process.env.MICROSOFT_CLIENT_SECRET || '';
    const tenantId = process.env.MICROSOFT_TENANT_ID || '';
    const watcherEmail = process.env.MICROSOFT_WATCHER_EMAIL || '';

    // Get access token
    const accessToken = await (emailWatcher as any).getAccessTokenDelegated(clientId, clientSecret, tenantId);

    // Fetch last 15 messages
    const url = `https://graph.microsoft.com/v1.0/users/${watcherEmail}/messages?$select=subject,sender,receivedDateTime&$top=15`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      throw new Error(`Graph API fetch failed: ${res.statusText}`);
    }

    const data = await res.json();
    const emails = data.value || [];

    console.log(`\n--- LAST ${emails.length} EMAILS IN INBOX OF ${watcherEmail} ---`);
    emails.forEach((email: any, idx: number) => {
      const senderAddr = email.sender?.emailAddress?.address || 'Unknown';
      console.log(`[Email ${idx + 1}] Received: ${email.receivedDateTime}`);
      console.log(`- From: "${senderAddr}"`);
      console.log(`- Subject: "${email.subject}"`);
      console.log('------------------------------------');
    });

  } catch (err: any) {
    console.error(`\n❌ Error fetching emails:`, err.message);
  } finally {
    await appContext.close();
    process.exit(0);
  }
}

run().catch((err) => {
  console.error('❌ Critical error:', err);
  process.exit(1);
});
