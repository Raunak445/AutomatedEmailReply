const { GoogleGenerativeAI } = require("@google/generative-ai");
const { addReplyJob } = require("./emailQueue");

const { GEMINI_API_KEY } = process.env;

// Initialize Google Generative AI
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Generate a reply to an email based on its classification.
 * @param {Object} emailData - Object containing email classification data.
 * @param {string} emailData.category - Category of the email.
 * @param {string} emailData.senderEmail - Email address of the sender.
 * @param {string} emailData.emailText - Text content of the email.
 * @returns {Promise<Object>} - Object containing the generated reply and sender's email address.
 */
async function generateReply(emailData) {
  try {
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // console.log("emailData",emailData)

    // Define the prompt for reply generation
    const prompt = `Write a suitable reply for the email having category "${emailData.category}"and email body as ${emailData.emailText} name of the sender is ${emailData.senderName}}`;

    // Generate content using the AI model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const replyText = await response.text();

    // Construct reply object
    const reply = {
      replyToEmail: replyText,
      senderEmail: emailData.senderEmail,
    };
    addReplyJob(reply);

    // console.log(reply);

  } catch (error) {
    console.error('Error generating reply:', error);
    return { error: error.message };
  }
}

// Example usage:
// (async () => {
//   const emailData = {
//     category: 'Interested',
//     senderEmail: 'sender@example.com',
//     emailText: 'Hi, I would like to know more about your services.',
//   };
//   const reply = await generateReply(emailData);
//   console.log('Generated Reply:', reply);
// })();

module.exports = generateReply;
