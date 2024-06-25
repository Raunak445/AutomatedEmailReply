const { Transformers } = require('@huggingface/models');
const dotenv = require('dotenv');
dotenv.config();

const { HUGGINGFACE_API_KEY } = process.env;

// Initialize the model and tokenizer
const modelId = "nlptown/bert-base-multilingual-uncased-sentiment";
const model = new Transformers({ apiKey: HUGGINGFACE_API_KEY });

/**
 * Classify the email using Hugging Face's model.
 * @param {string} message - The email message.
 * @returns {Promise<string>} - The classification category.
 */
async function classifyEmail(message) {
  const inputs = {
    inputs: message,
    parameters: { model: modelId }
  };

  const { data } = await model.pipeline('text-classification', inputs);
  const classification = data[0].label;

  return classification;
}

module.exports = { classifyEmail };
