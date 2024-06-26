const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');
const { promisify } = require('util');
const { classifyEmail } = require('./mailClassifier');
const generateReply = require('./generateReply');
require('dotenv').config();

const { CLIENT_ID, CLIENT_SECRET, REDIRECT_URI, TOKEN_PATH } = process.env;

// OAuth2 configuration
const oAuth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

// Promisify fs functions
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

async function authorizeGmail() {
  let token;
  try {
    token = await readFileAsync(TOKEN_PATH);
    if (token) {
      oAuth2Client.setCredentials(JSON.parse(token));
      if (!checkTokenValidity(oAuth2Client)) {
        token = await getGmailAccessToken();
        oAuth2Client.setCredentials(JSON.parse(token));
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      token = await getGmailAccessToken();
      oAuth2Client.setCredentials(JSON.parse(token));
    } else {
      throw err;
    }
  }
}

function checkTokenValidity(oAuth2Client) {
  const accessToken = oAuth2Client.getAccessToken();
  if (!accessToken) return false;
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
  await writeFileAsync(TOKEN_PATH, JSON.stringify(tokens));
  console.log('Token stored to', TOKEN_PATH);
  return tokens;
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
