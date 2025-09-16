# Bubbly Chat App

A real-time chat application with user authentication, friend management, and private messaging.

## Features

- User registration and authentication
- Friend management system
- Real-time private messaging
- Location sharing
- Message history

## Technology Stack

- Node.js
- Express.js
- Socket.io for real-time communication
- In-memory database (can be replaced with a persistent database)

## Deployment Instructions for Render.com

1. Create a new account or log in to [Render](https://render.com)

2. From the Render dashboard, click "New" and select "Web Service"

3. Connect your GitHub repository or manually deploy:
   - If using GitHub: Select the repository with your Bubbly app
   - If manual: Use the Render CLI or upload a zip file

4. Configure the service:
   - **Name**: bubbly-chat (or your preferred name)
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

5. Configure environment variables (if needed):
   - None required for basic functionality

6. Click "Create Web Service"

7. Your app will be deployed at: `https://[your-service-name].onrender.com`

## Local Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the development server: `npm run dev`
4. Open `http://localhost:3000` in your browser
