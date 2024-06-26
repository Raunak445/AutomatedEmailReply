const { Client } = require('@microsoft/microsoft-graph-client');
const { ConfidentialClientApplication } = require('@azure/msal-node');
const fs = require('fs');
const { promisify } = require('util');
const { classifyEmail } = require('./mailClassifier');
const generateReply = require('./generateReply');
require('dotenv').config();

const {
  OUTLOOK_CLIENT_ID,
  OUTLOOK_CLIENT_SECRET,
  OUTLOOK_TENANT_ID,
  OUTLOOK_REDIRECT_URI,
  OUTLOOK_TOKEN_PATH,   
} = process.env;

// Promisify fs functions
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);

// MSAL configuration
const msalConfig = {
  auth: {
    clientId: OUTLOOK_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${OUTLOOK_TENANT_ID}`,
    clientSecret: OUTLOOK_CLIENT_SECRET,
  },
  system: {
    loggerOptions: {
      loggerCallback(loglevel, message, containsPii) {
        console.log(message);
      },
      piiLoggingEnabled: false,
      logLevel: 'info',
    },
  },
};

const cca = new ConfidentialClientApplication(msalConfig);

async function authorizeOutlook() {
  let token;
  try {
    token = await readFileAsync(OUTLOOK_TOKEN_PATH);
    if (token) {
      const parsedToken = JSON.parse(token);
      if (!isTokenExpired(parsedToken)) {
        return parsedToken;3
      } else {
        const newToken = await getOutlookAccessToken();
        await writeFileAsync(OUTLOOK_TOKEN_PATH, JSON.stringify(newToken));
        return newToken;
      }
    } else {
      token = await getOutlookAccessToken();
      await writeFileAsync(OUTLOOK_TOKEN_PATH, JSON.stringify(token));
      return token;
    }
  } catch (err) {
    if (err.code === 'ENOENT') {
      token = await getOutlookAccessToken();
      await writeFileAsync(OUTLOOK_TOKEN_PATH, JSON.stringify(token));
      return token;
    } else {
      throw err;
    }
  }
}

function isTokenExpired(token) {
  const expiry = token.expiresOn;
  return expiry ? Date.now() > new Date(expiry) : true;
}

async function getOutlookAccessToken() {
  const authCodeUrlParameters = {
    scopes: ['https://graph.microsoft.com/.default'],
    redirectUri: OUTLOOK_REDIRECT_URI,
  };

  const authCodeUrl = await cca.getAuthCodeUrl(authCodeUrlParameters);
  console.log('Authorize this app by visiting this url:', authCodeUrl);

  // Replace this with the actual code obtained from redirect after user grants permission
  const code = await getAuthorizationCode(authCodeUrl);

  const tokenRequest = {
    code,
    scopes: ['https://graph.microsoft.com/.default'],
    redirectUri: OUTLOOK_REDIRECT_URI,
  };

  const response = await cca.acquireTokenByCode(tokenRequest);
  return response.accessToken;
}

function getAuthorizationCode(authCodeUrl) {
  // This function needs to handle the flow of getting the authorization code
  // For simplicity, replace this with your preferred method to get the auth code
  return new Promise((resolve, reject) => {
    // Implement a way to capture the authorization code from the URL
    // You can use a local server or prompt the user to paste the code
    // For now, we will simulate this by reading input from the console
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question('Enter the code from that page here: ', (code) => {
      rl.close();
      resolve(code);
    });
  });
}

async function listUnreadOutlookEmails(token) {
  const client = Client.init({
    authProvider: (done) => {
      done(null, token); // first parameter is the error, null in this case
    },
  });

  try {
    const result = await client
      .api('/me/mailFolders/inbox/messages')
      .filter('isRead eq false')
      .select('sender,subject,bodyPreview')
      .top(10)
      .get();

    if (result.value && result.value.length) {
      console.log('Unread Outlook emails:');
      for (const message of result.value) {
        await processOutlookEmail(client, message);
      }
    } else {
      console.log('No unread Outlook emails found.');
    }
  } catch (error) {
    console.error('Error listing Outlook emails:', error);
  }
}

async function processOutlookEmail(client, message) {
  try {
    const senderEmail = message.sender.emailAddress.address;
    const senderName = message.sender.emailAddress.name;
    const subject = message.subject || '(No Subject)';
    const body = message.bodyPreview;

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

    await client
      .api(`/me/messages/${message.id}`)
      .update({ isRead: true });

  } catch (error) {
    console.error('Error processing Outlook email:', error);
  }
}

async function pollOutlookEmails() {
  const token = await authorizeOutlook();
  setTimeout(async () => {
    await listUnreadOutlookEmails(token);
    pollOutlookEmails();
  }, 10000);
}

module.exports = {
  authorizeOutlook,
  pollOutlookEmails,
};
