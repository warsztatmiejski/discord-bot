// googlePhotos.js
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs');
const fetch = require('node-fetch');
const open = require('open');
const express = require('express');
const destroyer = require('server-destroy');

// Load client secrets from a local file
const credentials = require('./credentials.json'); // Ensure this file is secured
const TOKEN_PATH = 'token.json';

// Define the required scopes
const SCOPES = [
	'https://www.googleapis.com/auth/photoslibrary.appendonly',
	'https://www.googleapis.com/auth/photoslibrary.edit.appcreateddata',
];

const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;
const oAuth2Client = new OAuth2Client(
	client_id,
	client_secret,
	'http://localhost:3000/oauth2callback' // Set the redirect URI
);

// Function to authorize the client
async function authorize() {
	return new Promise((resolve, reject) => {
		fs.readFile(TOKEN_PATH, async (err, token) => {
			if (err) {
				try {
					const newToken = await getAccessToken(oAuth2Client);
					oAuth2Client.setCredentials(newToken);
					fs.writeFileSync(TOKEN_PATH, JSON.stringify(newToken));
					console.log('Token stored to', TOKEN_PATH);
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

// Helper function to make authorized HTTP requests
async function makeAuthorizedRequest(authClient, options) {
	const accessToken = await authClient.getAccessToken();
	const headers = {
		'Content-Type': 'application/json',
		Authorization: `Bearer ${accessToken.token}`,
		...options.headers,
	};

	const response = await fetch(options.url, {
		method: options.method || 'GET',
		headers,
		body: options.body ? JSON.stringify(options.body) : undefined,
	});

	if (!response.ok) {
		const errorBody = await response.text();
		throw new Error(`Request failed: ${response.status} ${response.statusText}\n${errorBody}`);
	}

	return response.json();
}

// Function to upload media to Google Photos
async function uploadMediaToGooglePhotos(authClient, mediaUrl, fileName, albumId) {
	// Download the media
	const response = await fetch(mediaUrl);
	const buffer = await response.buffer();

	// Get an upload URL
	const uploadUrl = 'https://photoslibrary.googleapis.com/v1/uploads';

	// Upload the media to get an upload token
	const accessToken = await authClient.getAccessToken();
	const uploadResponse = await fetch(uploadUrl, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/octet-stream',
			'X-Goog-Upload-File-Name': fileName,
			'X-Goog-Upload-Protocol': 'raw',
			Authorization: `Bearer ${accessToken.token}`,
		},
		body: buffer,
	});

	const uploadToken = await uploadResponse.text();

	if (!uploadResponse.ok) {
		throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}\n${uploadToken}`);
	}

	// Create the media item in the specified album
	const createMediaItemsUrl = 'https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate';
	const createMediaItemsBody = {
		albumId: albumId,
		newMediaItems: [{
			description: fileName,
			simpleMediaItem: {
				uploadToken: uploadToken,
			},
		}, ],
	};

	const createResponse = await makeAuthorizedRequest(authClient, {
		url: createMediaItemsUrl,
		method: 'POST',
		body: createMediaItemsBody,
	});

	return createResponse;
}

// Function to create a new album
async function createAlbum(authClient, albumName) {
	const createAlbumUrl = 'https://photoslibrary.googleapis.com/v1/albums';
	const body = {
		album: { title: albumName },
	};

	const response = await makeAuthorizedRequest(authClient, {
		url: createAlbumUrl,
		method: 'POST',
		body,
	});

	return response; // Returns the created album object
}

// Function to list albums created by the app
async function listAlbums(authClient) {
	const albums = [];
	let nextPageToken = null;

	do {
		const listAlbumsUrl = `https://photoslibrary.googleapis.com/v1/albums?pageSize=50&excludeNonAppCreatedData=true${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`;

		const response = await makeAuthorizedRequest(authClient, {
			url: listAlbumsUrl,
		});

		albums.push(...(response.albums || []));
		nextPageToken = response.nextPageToken;
	} while (nextPageToken);

	return albums;
}

module.exports = {
	authorize,
	uploadMediaToGooglePhotos,
	listAlbums,
	createAlbum,
};