// Google Drive

const { google } = require('googleapis');
const fs = require('fs');
const fetch = require('node-fetch');
const open = require('open');
const express = require('express');
const destroyer = require('server-destroy');
require('dotenv').config(); // Load environment variables

// Load client secrets from a local file
const credentials = require('./credentials.json'); // Ensure this file is secured
const TOKEN_PATH = 'token_drive.json'; // Renamed token file for Drive

// Define the required scopes
const SCOPES = [
	'https://www.googleapis.com/auth/drive.file',
	'https://www.googleapis.com/auth/drive',
];

const { client_secret, client_id } = credentials.installed || credentials.web;
const oAuth2Client = new google.auth.OAuth2(
	client_id,
	client_secret,
	'http://localhost:3000/oauth2callback' // Set the redirect URI
);

// Shared Drive ID from .env
const SHARED_DRIVE_ID = process.env.SHARED_DRIVE_ID; // Moved to .env

// Function to authorize the client
async function authorizeGoogleDrive() {
	return new Promise((resolve, reject) => {
		fs.readFile(TOKEN_PATH, async (err, token) => {
			if (err) {
				try {
					const newToken = await getAccessToken(oAuth2Client);
					oAuth2Client.setCredentials(newToken);
					fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken));
					console.log('Google Drive token stored to', TOKEN_PATH);
					resolve(oAuth2Client);
				} catch (error) {
					reject(error);
				}
			} else {
				oAuth2Client.setCredentials(JSON.parse(token));
				resolve(oAuth2Client);
			}
		});
	});
}

// Function to get a new access token
function getAccessToken(oAuth2Client) {
	return new Promise((resolve, reject) => {
		const app = express();

		// Generate the authorization URL
		const authUrl = oAuth2Client.generateAuthUrl({
			access_type: 'offline',
			scope: SCOPES,
		});
		console.log('Authorize this app by visiting this url:', authUrl);

		// Open the URL in the default browser
		open(authUrl);

		// Start a local server to receive the OAuth2 callback
		const server = app.listen(3000, '127.0.0.1', () => {
			console.log('Listening on port 3000 for OAuth2 callback');
		});

		destroyer(server); // Allow the server to be destroyed later

		app.get('/oauth2callback', async (req, res) => {
			const code = req.query.code;
			if (!code) {
				res.end('No code found in query parameters.');
				return;
			}

			try {
				const { tokens } = await oAuth2Client.getToken(code);
				oAuth2Client.setCredentials(tokens);
				res.send('Authentication successful! You can close this tab.');
				server.destroy();
				resolve(tokens);
			} catch (error) {
				console.error('Error retrieving access token', error);
				res.send('Error retrieving access token.');
				server.destroy();
				reject(error);
			}
		});
	});
}

// Function to list folders in the shared drive
async function listFoldersInDrive(authClient) {
	const drive = google.drive({ version: 'v3', auth: authClient });

	const res = await drive.files.list({
		q: `'${SHARED_DRIVE_ID}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
		fields: 'files(id, name)',
		supportsAllDrives: true,
		includeItemsFromAllDrives: true,
		corpora: 'drive',
		driveId: SHARED_DRIVE_ID,
	});

	return res.data.files;
}

// Function to create a new folder in the shared drive
async function createFolderInDrive(authClient, folderName) {
	const drive = google.drive({ version: 'v3', auth: authClient });

	const fileMetadata = {
		name: folderName,
		mimeType: 'application/vnd.google-apps.folder',
		parents: [SHARED_DRIVE_ID],
	};

	const res = await drive.files.create({
		requestBody: fileMetadata,
		fields: 'id, name, webViewLink',
		supportsAllDrives: true,
	});

	return res.data; // Contains id, name, and webViewLink
}

// Function to upload a file to the specified folder in the shared drive
async function uploadFileToGoogleDrive(authClient, mediaUrl, fileName, folderId, mimeType, displayName, username) {
	const drive = google.drive({ version: 'v3', auth: authClient });

	// Download the media as a stream
	const response = await fetch(mediaUrl);
	if (!response.ok) {
		throw new Error(`Failed to fetch media from URL: ${response.statusText}`);
	}
	const stream = response.body; // This is a readable stream

	const fileMetadata = {
		name: fileName,
		parents: [folderId],
		description: `Autor: ${displayName} (@${username} na Discord)`,
		properties: {
			uploadedBy: displayName,
			username: username,
		},
	};

	const media = {
		mimeType: mimeType,
		body: stream,
	};

	const res = await drive.files.create({
		requestBody: fileMetadata,
		media: media,
		fields: 'id',
		supportsAllDrives: true,
	});

	return res.data;
}

// Retrieve the folder name
async function getFolderInfoById(authClient, folderId) {
	const drive = google.drive({ version: 'v3', auth: authClient });

	const res = await drive.files.get({
		fileId: folderId,
		fields: 'name, webViewLink',
		supportsAllDrives: true,
	});

	return {
		name: res.data.name,
		webViewLink: res.data.webViewLink,
	};
}

module.exports = {
	authorizeGoogleDrive,
	uploadFileToGoogleDrive,
	listFoldersInDrive,
	createFolderInDrive,
	getFolderInfoById,
};