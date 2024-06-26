const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');
const { promisify } = require('util');
require('dotenv').config();
const generateReply =require('./generateReply.js')

const { classifyEmail } = require('./mailClassifier');

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, TOKEN_PATH } = process.env;

const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
let refreshTimer;

async function authorizeGmail() {
  let token;
  try {
    token = await readFileAsync(TOKEN_PATH);
    if (token) {
      oAuth2Client.setCredentials(JSON.parse(token));
      if (!checkTokenValidity(oAuth2Client)) {
        await refreshAccessToken();
      }
      scheduleTokenRefresh(oAuth2Client);
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      await getGmailAccessToken();
    } else {
      throw err;
    }
  }
}

function checkTokenValidity(oAuth2Client) {
  const expiry = oAuth2Client.credentials.expiry_date;
  return expiry ? Date.now() < expiry : true;
}

async function getGmailAccessToken() {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.modify'],
  });
  console.log('Authorize this app by visiting this url:', authUrl);
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const code = await new Promise((resolve) => {
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      resolve(code);
    });
  });
  const { tokens } = await oAuth2Client.getToken(code);
  await saveToken(tokens);
  oAuth2Client.setCredentials(tokens);
  scheduleTokenRefresh(oAuth2Client);
}

async function saveToken(token) {
  try {
    await writeFileAsync(TOKEN_PATH, JSON.stringify(token));
    console.log('Token stored to', TOKEN_PATH);
  } catch (error) {
    console.error('Error saving token:', error);
  }
}

function scheduleTokenRefresh(oAuth2Client) {
  const expiry = oAuth2Client.credentials.expiry_date;
  if (!expiry) return;

  const refreshTime = (expiry - Date.now()) / 2; // Schedule at half of the expiry duration

  if (refreshTimer) {
    clearTimeout(refreshTimer);
  }

  refreshTimer = setTimeout(async () => {
    await refreshAccessToken();
  }, refreshTime);
}

async function refreshAccessToken() {
  try {
    const { credentials } = await oAuth2Client.refreshAccessToken();
    await saveToken(credentials);
    oAuth2Client.setCredentials(credentials);
    console.log('Access token refreshed');
    scheduleTokenRefresh(oAuth2Client);
  } catch (error) {
    console.error('Error refreshing access token:', error);
  }
}

async function listUnreadGmailEmails() {
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
  });
  const messages = res.data.messages;
  if (messages && messages.length) {
    console.log('Unread Gmail emails:');
    for (const message of messages) {
      await processGmailEmail(gmail, message.id);
    }
  } else {
    console.log('No unread Gmail emails found.');
  }
}

async function processGmailEmail(gmail, messageId) {
  try {
    const res = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    const headers = res.data.payload.headers;
    const fromHeader = headers.find((header) => header.name === 'From');
    let senderName = '';
    let senderEmail = '';

    if (fromHeader) {
      const match = fromHeader.value.match(/^(.+?) <(.+?)>$/);
      if (match) {
        senderName = match[1];
        senderEmail = match[2];
      } else {
        senderEmail = fromHeader.value;
      }
    }

    const subject = headers.find((header) => header.name === 'Subject').value || '(No Subject)';

    const body = getBody(res.data.payload);

    if (body) {
      const classification = await classifyEmail(body);

      const emailData = {
        category: classification.category,
        senderName: senderName,
        senderEmail: senderEmail,
        emailText: body,
      };

      const reply = await generateReply(emailData);
      console.log('Generated Reply:', reply);
    }

    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      resource: {
        removeLabelIds: ['UNREAD'],
      },
    });
  } catch (error) {
    console.error('Error processing Gmail email:', error);
  }
}

function getBody(payload) {
  const parts = payload.parts;
  if (parts) {
    for (const part of parts) {
      if (part.mimeType === 'text/plain' && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString('utf8');
      } else if (part.mimeType === 'multipart/alternative') {
        return getBody(part);
      }
    }
  }
  return '';
}

async function pollGmailEmails() {
  setTimeout(async () => {
    await listUnreadGmailEmails();
    pollGmailEmails();
  }, 10000);
}

module.exports = {
  authorizeGmail,
  pollGmailEmails,
};
