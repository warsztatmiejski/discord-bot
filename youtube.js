const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const { Transform } = require('stream');

const express = require('express');
const fetch = require('node-fetch');
const open = require('open');
const { google } = require('googleapis');

const YOUTUBE_SCOPE = 'https://www.googleapis.com/auth/youtube.force-ssl';
const DEFAULT_TOKEN_PATH = path.resolve(__dirname, 'token_youtube.json');
const DEFAULT_CREDENTIALS_PATH = path.resolve(__dirname, 'credentials.json');
const DEFAULT_REDIRECT_URI = 'http://localhost:3000/oauth2callback';
const DEFAULT_MAX_UPLOAD_BYTES = 20_000_000;
const DEFAULT_PROCESSING_TIMEOUT_MS = 10 * 60 * 1000;
const DEFAULT_PROCESSING_POLL_MS = 15_000;
const RETRYABLE_UPLOAD_STATUSES = new Set([429, 500, 502, 503, 504]);

let authorizationPromise;

function requiredEnvironment(name) {
	const value = process.env[name]?.trim();
	if (!value) throw new Error(`Missing required environment variable: ${name}`);
	return value;
}

function optionalBoolean(value) {
	if (value === true || value === 'true') return true;
	if (value === false || value === 'false') return false;
	return undefined;
}

async function readOAuthCredentials() {
	const credentialsPath = process.env.YOUTUBE_CREDENTIALS_PATH || DEFAULT_CREDENTIALS_PATH;
	const credentials = JSON.parse(await fs.promises.readFile(credentialsPath, 'utf8'));
	const client = credentials.installed || credentials.web;
	if (!client?.client_id || !client?.client_secret) {
		throw new Error(`Invalid Google OAuth credentials in ${credentialsPath}`);
	}
	return client;
}

async function requestInitialToken(oAuth2Client, redirectUri) {
	const app = express();
	const callbackUrl = new URL(redirectUri);
	const port = Number(callbackUrl.port) || (callbackUrl.protocol === 'https:' ? 443 : 80);
	const state = crypto.randomBytes(24).toString('hex');
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: 'offline',
		prompt: 'consent',
		scope: [YOUTUBE_SCOPE],
		state,
	});

	return new Promise((resolve, reject) => {
		let settled = false;
		const server = app.listen(port, callbackUrl.hostname, async () => {
			console.log('Authorize YouTube access by visiting:', authUrl);
			try {
				await open(authUrl);
			} catch (error) {
				console.error('Could not open the YouTube authorization URL:', error);
			}
		});

		function finish(error, tokens) {
			if (settled) return;
			settled = true;
			server.close(() => {
				if (error) reject(error);
				else resolve(tokens);
			});
		}

		server.on('error', finish);
		app.get(callbackUrl.pathname, async (req, res) => {
			if (req.query.state !== state) {
				res.status(400).send('Invalid OAuth state.');
				finish(new Error('Invalid OAuth state returned by Google'));
				return;
			}
			if (!req.query.code) {
				res.status(400).send('Missing OAuth authorization code.');
				finish(new Error('Missing OAuth authorization code'));
				return;
			}

			try {
				const { tokens } = await oAuth2Client.getToken(req.query.code);
				res.send('YouTube authorization successful. You can close this tab.');
				finish(null, tokens);
			} catch (error) {
				res.status(500).send('YouTube authorization failed.');
				finish(error);
			}
		});
	});
}

async function authorizeYouTubeInternal() {
	const credentials = await readOAuthCredentials();
	const redirectUri = process.env.YOUTUBE_REDIRECT_URI || DEFAULT_REDIRECT_URI;
	const tokenPath = process.env.YOUTUBE_TOKEN_PATH || DEFAULT_TOKEN_PATH;
	const oAuth2Client = new google.auth.OAuth2(
		credentials.client_id,
		credentials.client_secret,
		redirectUri
	);

	let tokens;
	try {
		tokens = JSON.parse(await fs.promises.readFile(tokenPath, 'utf8'));
	} catch (error) {
		if (error.code !== 'ENOENT') throw error;
		tokens = await requestInitialToken(oAuth2Client, redirectUri);
		await fs.promises.mkdir(path.dirname(tokenPath), { recursive: true });
		await fs.promises.writeFile(tokenPath, JSON.stringify(tokens), { mode: 0o600 });
		console.log('YouTube OAuth token stored in', tokenPath);
	}

	oAuth2Client.setCredentials(tokens);
	return oAuth2Client;
}

function authorizeYouTube() {
	if (!authorizationPromise) {
		authorizationPromise = authorizeYouTubeInternal().catch((error) => {
			authorizationPromise = null;
			throw error;
		});
	}
	return authorizationPromise;
}

async function verifyAuthorizedChannel(authClient) {
	const expectedChannelId = requiredEnvironment('YOUTUBE_CHANNEL_ID');
	const youtube = google.youtube({ version: 'v3', auth: authClient });
	const response = await youtube.channels.list({ part: ['id', 'snippet'], mine: true });
	const channel = response.data.items?.find((item) => item.id === expectedChannelId);

	if (!channel) {
		const authorizedIds = response.data.items?.map((item) => item.id).join(', ') || 'none';
		throw new Error(
			`YouTube OAuth token is not authorized for channel ${expectedChannelId}; authorized channel IDs: ${authorizedIds}`
		);
	}

	return channel;
}

async function downloadVideo(mediaUrl, declaredSize) {
	const maximumBytes =
		Number(process.env.GALLERY_MAX_DISCORD_VIDEO_BYTES) ||
		DEFAULT_MAX_UPLOAD_BYTES;
	if (declaredSize && declaredSize > maximumBytes) {
		throw new Error(`Video is larger than the configured ${maximumBytes}-byte limit`);
	}

	const temporaryDirectory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'discord-youtube-'));
	const temporaryFile = path.join(temporaryDirectory, 'video-upload');
	const response = await fetch(mediaUrl);
	if (!response.ok) {
		await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
		throw new Error(`Could not download Discord video: HTTP ${response.status}`);
	}

	const responseLength = Number(response.headers.get('content-length'));
	if (responseLength && responseLength > maximumBytes) {
		await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
		throw new Error(`Downloaded video is larger than the configured ${maximumBytes}-byte limit`);
	}

	let downloadedBytes = 0;
	const limiter = new Transform({
		transform(chunk, encoding, callback) {
			downloadedBytes += chunk.length;
			if (downloadedBytes > maximumBytes) {
				callback(new Error(`Downloaded video exceeded the configured ${maximumBytes}-byte limit`));
				return;
			}
			callback(null, chunk);
		},
	});

	try {
		await pipeline(response.body, limiter, fs.createWriteStream(temporaryFile, { mode: 0o600 }));
		if (downloadedBytes === 0) throw new Error('Downloaded Discord video is empty');
		return {
			filePath: temporaryFile,
			size: downloadedBytes,
			cleanup: () => fs.promises.rm(temporaryDirectory, { recursive: true, force: true }),
		};
	} catch (error) {
		await fs.promises.rm(temporaryDirectory, { recursive: true, force: true });
		throw error;
	}
}

async function getAccessToken(authClient) {
	const result = await authClient.getAccessToken();
	const token = typeof result === 'string' ? result : result?.token;
	if (!token) throw new Error('Could not obtain a YouTube OAuth access token');
	return token;
}

async function initiateResumableUpload(authClient, metadata, mimeType, size) {
	const accessToken = await getAccessToken(authClient);
	const endpoint = new URL('https://www.googleapis.com/upload/youtube/v3/videos');
	endpoint.searchParams.set('uploadType', 'resumable');
	endpoint.searchParams.set('part', 'snippet,status');
	endpoint.searchParams.set('notifySubscribers', String(metadata.notifySubscribers));

	const response = await fetch(endpoint.toString(), {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Type': 'application/json; charset=UTF-8',
			'X-Upload-Content-Length': String(size),
			'X-Upload-Content-Type': mimeType,
		},
		body: JSON.stringify({
			snippet: {
				title: metadata.title,
				description: metadata.description,
				categoryId: metadata.categoryId,
			},
			status: {
				privacyStatus: metadata.privacyStatus,
				embeddable: true,
				...(metadata.selfDeclaredMadeForKids === undefined
					? {}
					: { selfDeclaredMadeForKids: metadata.selfDeclaredMadeForKids }),
			},
		}),
	});

	if (!response.ok) {
		throw new Error(`Could not start YouTube upload: HTTP ${response.status} ${await response.text()}`);
	}
	const uploadUrl = response.headers.get('location');
	if (!uploadUrl) throw new Error('YouTube did not return a resumable upload URL');
	return { uploadUrl, accessToken };
}

function nextByteFromRange(rangeHeader) {
	const match = /bytes=0-(\d+)/.exec(rangeHeader || '');
	return match ? Number(match[1]) + 1 : 0;
}

async function queryUploadProgress(uploadUrl, accessToken, size) {
	const response = await fetch(uploadUrl, {
		method: 'PUT',
		headers: {
			Authorization: `Bearer ${accessToken}`,
			'Content-Length': '0',
			'Content-Range': `bytes */${size}`,
		},
		redirect: 'manual',
	});

	if (response.status === 308) {
		return { nextByte: nextByteFromRange(response.headers.get('range')) };
	}
	if (response.ok) return { video: await response.json() };
	throw new Error(`Could not query YouTube upload progress: HTTP ${response.status}`);
}

async function completeResumableUpload(filePath, size, mimeType, uploadUrl, accessToken) {
	let nextByte = 0;
	let retry = 0;

	while (retry <= 5) {
		if (nextByte >= size) {
			const progress = await queryUploadProgress(uploadUrl, accessToken, size);
			if (progress.video) return progress.video;
			throw new Error('YouTube reported all bytes received without completing the upload');
		}
		const body = fs.createReadStream(filePath, { start: nextByte });
		try {
			const response = await fetch(uploadUrl, {
				method: 'PUT',
				headers: {
					Authorization: `Bearer ${accessToken}`,
					'Content-Length': String(size - nextByte),
					'Content-Type': mimeType,
					'Content-Range': `bytes ${nextByte}-${size - 1}/${size}`,
				},
				body,
				redirect: 'manual',
			});

			if (response.ok) return response.json();
			if (response.status === 308) {
				const reportedNextByte = nextByteFromRange(response.headers.get('range'));
				if (reportedNextByte <= nextByte) retry += 1;
				nextByte = reportedNextByte;
				continue;
			}
			if (!RETRYABLE_UPLOAD_STATUSES.has(response.status)) {
				const error = new Error(
					`YouTube upload failed: HTTP ${response.status} ${await response.text()}`
				);
				error.nonRetryable = true;
				throw error;
			}
		} catch (error) {
			if (error.nonRetryable) throw error;
			if (retry >= 5) throw error;
		}

		retry += 1;
		await new Promise((resolve) => setTimeout(resolve, Math.min(2 ** retry * 1000, 30_000)));
		const progress = await queryUploadProgress(uploadUrl, accessToken, size);
		if (progress.video) return progress.video;
		nextByte = progress.nextByte;
	}

	throw new Error('YouTube upload failed after retries');
}

async function uploadDiscordVideo({ mediaUrl, mimeType, size, metadata }) {
	requiredEnvironment('YOUTUBE_PLAYLIST_ID');
	const authClient = await authorizeYouTube();
	await verifyAuthorizedChannel(authClient);
	const downloaded = await downloadVideo(mediaUrl, size);

	try {
		const uploadMetadata = {
			...metadata,
			categoryId: process.env.YOUTUBE_CATEGORY_ID || '22',
			privacyStatus: process.env.YOUTUBE_PRIVACY_STATUS || 'unlisted',
			notifySubscribers: optionalBoolean(process.env.YOUTUBE_NOTIFY_SUBSCRIBERS) ?? false,
			selfDeclaredMadeForKids: optionalBoolean(process.env.YOUTUBE_MADE_FOR_KIDS),
		};
		const session = await initiateResumableUpload(
			authClient,
			uploadMetadata,
			mimeType || 'application/octet-stream',
			downloaded.size
		);
		const video = await completeResumableUpload(
			downloaded.filePath,
			downloaded.size,
			mimeType || 'application/octet-stream',
			session.uploadUrl,
			session.accessToken
		);
		if (!video.id) throw new Error('YouTube upload response did not contain a video ID');
		return video;
	} finally {
		await downloaded.cleanup();
	}
}

async function waitForVideoReady(videoId) {
	const authClient = await authorizeYouTube();
	const youtube = google.youtube({ version: 'v3', auth: authClient });
	const timeoutMs = Number(process.env.YOUTUBE_PROCESSING_TIMEOUT_MS) || DEFAULT_PROCESSING_TIMEOUT_MS;
	const pollMs = Number(process.env.YOUTUBE_PROCESSING_POLL_MS) || DEFAULT_PROCESSING_POLL_MS;
	const deadline = Date.now() + timeoutMs;

	while (Date.now() < deadline) {
		const response = await youtube.videos.list({
			part: ['status', 'processingDetails'],
			id: [videoId],
		});
		const video = response.data.items?.[0];
		const uploadStatus = video?.status?.uploadStatus;
		const processingStatus = video?.processingDetails?.processingStatus;

		if (['failed', 'rejected', 'deleted'].includes(uploadStatus) || processingStatus === 'terminated') {
			throw new Error(`YouTube rejected or failed processing video ${videoId}`);
		}
		if (uploadStatus === 'processed' || processingStatus === 'succeeded') {
			const expectedPrivacy = process.env.YOUTUBE_PRIVACY_STATUS || 'unlisted';
			if (expectedPrivacy !== 'private' && video.status?.privacyStatus === 'private') {
				throw new Error(
					'YouTube kept the uploaded video private; verify the API project audit and channel settings'
				);
			}
			return video;
		}

		await new Promise((resolve) => setTimeout(resolve, pollMs));
	}

	throw new Error(`YouTube processing timed out for video ${videoId}`);
}

async function addVideoToPlaylist(videoId) {
	const playlistId = requiredEnvironment('YOUTUBE_PLAYLIST_ID');
	const authClient = await authorizeYouTube();
	const youtube = google.youtube({ version: 'v3', auth: authClient });
	const existing = await youtube.playlistItems.list({
		part: ['id'],
		playlistId,
		videoId,
		maxResults: 1,
	});
	if (existing.data.items?.[0]) {
		return { playlistId, playlistItemId: existing.data.items[0].id };
	}
	const response = await youtube.playlistItems.insert({
		part: ['snippet'],
		requestBody: {
			snippet: {
				playlistId,
				resourceId: { kind: 'youtube#video', videoId },
			},
		},
	});
	return { playlistId, playlistItemId: response.data.id };
}

module.exports = {
	addVideoToPlaylist,
	authorizeYouTube,
	nextByteFromRange,
	optionalBoolean,
	uploadDiscordVideo,
	verifyAuthorizedChannel,
	waitForVideoReady,
};
