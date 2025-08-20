// gmail.js - Gmail integration using existing Drive credentials and redirect URI

const { google } = require('googleapis');
const fs = require('fs');
require('dotenv').config();

// Reuse the same credentials file as Google Drive
const credentials = require('./credentials.json');
const TOKEN_PATH = 'token_gmail.json';

// Gmail scopes
const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly'
];

const { client_secret, client_id } = credentials.installed || credentials.web;

// Use the same redirect URI as your Google Drive setup
const oAuth2Client = new google.auth.OAuth2(
  client_id,
  client_secret,
  'http://localhost:3000/oauth2callback' // Same as your Drive setup
);

// Function to authorize Gmail access
async function authorizeGmail() {
  return new Promise((resolve, reject) => {
	fs.readFile(TOKEN_PATH, async (err, token) => {
	  if (err) {
		console.log('\n=== Gmail Authorization Required ===');
		console.log('Gmail access needs to be authorized separately from Google Drive.');
		console.log('');
		console.log('MANUAL AUTHORIZATION STEPS:');
		console.log('1. Visit this URL in your LOCAL browser (on your computer, not server):');

		const authUrl = oAuth2Client.generateAuthUrl({
		  access_type: 'offline',
		  scope: GMAIL_SCOPES,
		});

		console.log('\n' + authUrl + '\n');
		console.log('2. Sign in with faktury@warsztatmiejski.org');
		console.log('3. Grant permissions');
		console.log('4. The page will try to redirect to localhost:3000 and fail');
		console.log('5. Copy the FULL URL from your browser address bar');
		console.log('6. Look for "code=" in the URL and copy the code after it');
		console.log('   Example: http://localhost:3000/oauth2callback?code=4/0AfJohXl...');
		console.log('   Copy: 4/0AfJohXl...');
		console.log('7. Add the code to your .env file: GMAIL_AUTH_CODE=your_code_here');
		console.log('8. Restart the bot');
		console.log('=====================================\n');

		// Check for auth code
		if (process.env.GMAIL_AUTH_CODE) {
		  try {
			console.log('Found GMAIL_AUTH_CODE, exchanging for tokens...');
			const { tokens } = await oAuth2Client.getToken(process.env.GMAIL_AUTH_CODE);
			oAuth2Client.setCredentials(tokens);
			fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
			console.log('✅ Gmail tokens stored to', TOKEN_PATH);
			console.log('✅ You can now remove GMAIL_AUTH_CODE from your .env file');
			resolve(oAuth2Client);
		  } catch (error) {
			console.error('❌ Error exchanging auth code for tokens:', error);
			reject(new Error('Invalid or expired authorization code. Please get a new one following the steps above.'));
		  }
		} else {
		  reject(new Error('Gmail authorization required. Please follow the manual steps above.'));
		}
	  } else {
		try {
		  const tokenData = JSON.parse(token);
		  oAuth2Client.setCredentials(tokenData);

		  // Check if token needs refresh
		  if (tokenData.expiry_date && Date.now() >= tokenData.expiry_date) {
			console.log('Gmail token expired, refreshing...');
			const { credentials } = await oAuth2Client.refreshAccessToken();
			oAuth2Client.setCredentials(credentials);
			fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
			console.log('Gmail token refreshed');
		  }

		  resolve(oAuth2Client);
		} catch (error) {
		  console.error('Error loading Gmail token:', error);
		  // If token is corrupted, delete it and require re-authorization
		  fs.unlinkSync(TOKEN_PATH);
		  reject(new Error('Gmail token corrupted, please restart bot to re-authorize'));
		}
	  }
	});
  });
}

// Function to get unread emails
async function getUnreadEmails(authClient) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  try {
	// Search for unread emails
	const response = await gmail.users.messages.list({
	  userId: 'me',
	  q: 'is:unread',
	  maxResults: 10
	});

	if (!response.data.messages) {
	  return [];
	}

	// Get details for each unread email
	const emailDetails = [];
	for (const message of response.data.messages) {
	  const details = await gmail.users.messages.get({
		userId: 'me',
		id: message.id,
		format: 'metadata',
		metadataHeaders: ['From', 'Subject', 'Date']
	  });

	  const headers = details.data.payload.headers;
	  const fromHeader = headers.find(h => h.name === 'From');
	  const subjectHeader = headers.find(h => h.name === 'Subject');
	  const dateHeader = headers.find(h => h.name === 'Date');

	  emailDetails.push({
		id: message.id,
		from: fromHeader ? fromHeader.value : 'Unknown sender',
		subject: subjectHeader ? subjectHeader.value : 'No subject',
		date: dateHeader ? new Date(dateHeader.value) : new Date(),
		snippet: details.data.snippet || ''
	  });
	}

	return emailDetails;
  } catch (error) {
	console.error('Error fetching unread emails:', error);
	throw error;
  }
}

// Function to mark emails as read (optional)
async function markEmailAsRead(authClient, messageId) {
  const gmail = google.gmail({ version: 'v1', auth: authClient });

  try {
	await gmail.users.messages.modify({
	  userId: 'me',
	  id: messageId,
	  requestBody: {
		removeLabelIds: ['UNREAD']
	  }
	});
  } catch (error) {
	console.error('Error marking email as read:', error);
	throw error;
  }
}

module.exports = {
  authorizeGmail,
  getUnreadEmails,
  markEmailAsRead
};