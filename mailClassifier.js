const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require('dotenv');

dotenv.config();

const { GEMINI_API_KEY } = process.env;

// Initialize Google Generative AI

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

/**
 * Classify the email using Google's Generative AI.
 * @param {string} emailText - The email message.
 * @returns {Promise<object>} - The classification result and the original email.
 */
async function classifyEmail(emailText) {

  // console.log("emailText",emailText)
  try {
    // Get the generative model
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Define the prompt for classification
    const prompt = `Categorize the following email into one of the categories: Interested, Not Interested, More Information: "${emailText}"`;

    // Generate content using the AI model
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = await response.text();
    // console.log("text",text)

    // Interpret the result to one of our categories
    let category;
    if (text.includes("Not Interested")) {
      category = "Not Interested";
    } else if (text.includes("Interested")) {
      category = "Interested";
    } else if (text.includes("More Information")) {
      category = "More Information";
    } else {
      category = "Uncategorized"; // Default category if no clear match
    }

    return { category, emailText };
  } catch (error) {
    console.error('Error classifying email:', error);
    return { category: 'Error', emailText, error: error.message };
  }
}

// Example usage
// (async () => {
//   const emailMessage = "Hi, I'm interested in learning more about your services.";
//   const categorizedEmail = await classifyEmail(emailMessage);
//   console.log(categorizedEmail);
// })();

module.exports = { classifyEmail };
