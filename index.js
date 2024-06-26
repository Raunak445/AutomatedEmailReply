const { authorizeGmail, pollGmailEmails } = require('./gmailService');
const { authorizeOutlook, pollOutlookEmails } = require('./outlookService');

// Authorize and start polling Gmail
authorizeGmail()
  .then(() => {
    pollGmailEmails();
  })
  .catch(console.error);

// Authorize and start polling Outlook
// authorizeOutlook()
//   .then(() => {
//     pollOutlookEmails();
//   })
//   .catch(console.error);
