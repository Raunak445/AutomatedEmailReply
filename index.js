const { google } = require('googleapis');
const fs = require('fs');
const readline = require('readline');
const { promisify } = require('util');
const { classifyEmail } = require('./mailClassifier');
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
  const token = await readFileAsync(TOKEN_PATH).catch(async (err) => {
    if (err.code === 'ENOENT') {
      return await getAccessToken();
    } else {
      throw err;
    }
  });
  oAuth2Client.setCredentials(JSON.parse(token));
}

/**
 * Get and store new token after prompting for user authorization.
 * @returns {Promise<string>} The access token.
 */
async function getAccessToken() {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/gmail.modify']
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
    const subject = headers.find(header => header.name === 'Subject').value || '(No Subject)';
    console.log('Subject:', subject);

    const body = getBody(res.data.payload);
    console.log('Body:', body);


    if (body) {
      // console.log("body",body)
      const classification = await classifyEmail(body);
      console.log('Classification:', classification);

      // // Clear the header and body data for the next iteration
      // subject = '';
      // body = '';
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
