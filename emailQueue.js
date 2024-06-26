const { Worker, Queue } = require('bullmq');
const { sendEmail } = require('./nodemailer'); // Replace with correct path

const connection = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
};

const emailQueue = new Queue('emailQueue', { connection });

// console.log(emailQueue);

// Example usage in a worker
const emailWorker = new Worker(
  'emailQueue',
  async (job) => {
    console.log('Processing job:', job.id, job.data);
    try {
      await sendEmail(job.data.senderEmail, job.data.replyToEmail);
    } catch (error) {
      console.error('Error processing email job:', error);
      // Handle error as needed, e.g., retrying or logging
    }
  },
  { connection }
);

emailWorker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

emailWorker.on('failed', (job, err) => {
  console.error(`Job ${job.id} failed with error: ${err.message}`);
});

// Function to add a new email job to the queue
const addReplyJob = async (reply) => {
  try {
    await emailQueue.add('sendEmail', reply);
    console.log('Job added to queue:', reply);
  } catch (error) {
    console.error('Error adding job to queue:', error);
  }
};

module.exports = {
  addReplyJob,
};
