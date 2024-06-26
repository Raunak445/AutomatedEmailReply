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

// Authorize a client with credentials, then call the Gmail API
authorize()
  .then(() => {
    // Start polling for unread emails after authorization
    pollEmails();
  })
  .catch(console.error);

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * authorization flow.
 * @returns {Promise<void>}
 */
async function authorize() {
  let token;
  try {
    token = await readFileAsync(TOKEN_PATH);
    if (token) {
      oAuth2Client.setCredentials(JSON.parse(token));
      if (!checkTokenValidity(oAuth2Client)) {
        token = await getAccessToken();
        oAuth2Client.setCredentials(JSON.parse(token));
      }
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      token = await getAccessToken();
      oAuth2Client.setCredentials(JSON.parse(token));
    } else {
      throw err;
    }
  }
}

/**
 * Check if the OAuth2 token is expired or invalid.
 * @param {OAuth2Client} oAuth2Client - The OAuth2 client instance.
 * @returns {boolean} - True if token is valid, false otherwise.
 */
function checkTokenValidity(oAuth2Client) {
  const accessToken = oAuth2Client.getAccessToken();
  if (!accessToken) return false;
  const expiry = oAuth2Client.credentials.expiry_date;
  return expiry ? Date.now() < expiry : true;
}

/**
 * Get and store new token after prompting for user authorization.
 * @returns {Promise<string>} The access token.
 */
async function getAccessToken() {
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

/**
 * Lists the unread emails in the user's Gmail inbox.
 * @returns {Promise<void>}
 */
async function listUnreadEmails() {
  const gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  const res = await gmail.users.messages.list({
    userId: 'me',
    q: 'is:unread',
  });
  const messages = res.data.messages;
  if (messages && messages.length) {
    console.log('Unread emails:');
    for (const message of messages) {
      await processEmail(gmail, message.id);
    }
  } else {
    console.log('No unread emails found.');
  }
}

/**
 * Processes an individual email.
 * @param {Object} gmail - The Gmail API client.
 * @param {string} messageId - The ID of the email message.
 * @returns {Promise<void>}
 */
async function processEmail(gmail, messageId) {
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
        senderName = match[1]; // Extract sender's name
        senderEmail = match[2]; // Extract sender's email
      } else {
        // Fallback in case the header format doesn't match expected pattern
        senderEmail = fromHeader.value;
      }
    }

    const subject = headers.find((header) => header.name === 'Subject').value || '(No Subject)';

    const body = getBody(res.data.payload);

    if (body) {
      const classification = await classifyEmail(body);

      // Generate reply using generateReply function or other method
      const emailData = {
        category: classification.category,
        senderName: senderName,
        senderEmail: senderEmail,
        emailText: body,
      };
      
      const reply = await generateReply(emailData);
      console.log('Generated Reply:', reply);
    }

    // Mark email as read to avoid reprocessing
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      resource: {
        removeLabelIds: ['UNREAD'],
      },
    });
  } catch (error) {
    console.error('Error processing email:', error);
  }
}

/**
 * Extract the message body.
 * @param {Object} payload - The message payload.
 * @returns {string} - The message body.
 */
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

// Start polling emails every 10 seconds
function pollEmails() {
  setTimeout(async () => {
    await listUnreadEmails();
    pollEmails();
  }, 10000); // 10 seconds
}
