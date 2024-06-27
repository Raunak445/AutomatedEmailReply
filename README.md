# Automated Email Response Tool

This tool is designed to automatically read and respond to emails in a Gmail account using OpenAI for generating responses and BullMQ for task scheduling. It classifies incoming emails and sends appropriate replies based on the content.

## Features

1. **OAuth2 Authentication**: Connect and authenticate with Gmail using OAuth2.
2. **Email Reading**: Fetch unread emails from Gmail every 10 seconds.
3. **Email Classification**: Classify emails into categories like Interested, Not Interested, and More Information.
4. **Automated Reply**: Generate and send automated replies using OpenAI based on the email content.
5. **Task Scheduling**: Use BullMQ to handle the tasks of reading, classifying, and responding to emails.

## Prerequisites

- Node.js and npm installed on your system.
- Docker installed for running Redis.
- A Google Cloud project with OAuth2 credentials.
- An OpenAI API key.

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd <repository-directory>
```

2. Install Dependencies
npm install

3. Start the redis server (need to install docker )
docker run -itd -p 6379:6379 redis

4.Start the server 
npm run dev


# .env file details

# Google OAuth2 Credentials
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=your-google-redirect-uri
GOOGLE_TOKEN_PATH=token.json


# Gemini API Key
GEMINI_API_KEY=your-gemini-api-key

# Email Credentials
EMAIL_PASSWORD=your-email-password
EMAIL=your-email-address

# Outlook OAuth2 Credentials
OUTLOOK_CLIENT_ID=your-outlook-client-id
OUTLOOK_CLIENT_SECRET=your-outlook-client-secret
OUTLOOK_TENANT_ID=your-outlook-tenant-id
OUTLOOK_REDIRECT_URI=your-outlook-redirect-uri
OUTLOOK_TOKEN_PATH=outlookToken.json
OUTLOOK_CLIENT_SECRET_Value=your-outlook-client-secret-value

Note for the first time you will need to authorise your gmail account for tokens





