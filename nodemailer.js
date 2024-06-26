const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const { EMAIL, EMAIL_PASSWORD } = process.env;

// Create a SMTP transporter using your email provider's SMTP settings
const transporter = nodemailer.createTransport({
  service: 'Gmail', // Use your email service provider (e.g., Gmail, Outlook, etc.)
  auth: {
    user: EMAIL,
    pass: EMAIL_PASSWORD,
  },
});

// Function to send an email
const sendEmail = async (senderEmail, replyToEmail) => {
  try {
    // Send mail with defined transport object
    const info = await transporter.sendMail({
      from: `"Your Name" <${EMAIL}>`, // sender address
      to: senderEmail, // list of receivers
      subject: 'Reply to Your Inquiry', // Subject line
      text: replyToEmail, // plain text body
    });

    console.log(`Email sent: ${info.messageId}`);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Export the sendEmail function for external use
module.exports = {
  sendEmail,
};
