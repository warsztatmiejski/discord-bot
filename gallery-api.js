const FormData = require('form-data');
const fetch = require('node-fetch');

const DEFAULT_BASE_URL = 'https://warsztatmiejski.org';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_IMAGE_BYTES = 20_000_000;

class GalleryApiError extends Error {
	constructor(message, status = null, responseBody = null) {
		super(message);
		this.name = 'GalleryApiError';
		this.status = status;
		this.responseBody = responseBody;
	}
}

function requireToken() {
	const value = process.env.GALLERY_DISCORD_INGEST_SECRET?.trim();
	if (!value) {
		throw new GalleryApiError(
			'Missing required environment variable: GALLERY_DISCORD_INGEST_SECRET'
		);
	}
	return value;
}

async function parseResponse(response) {
	const responseText = await response.text();
	let responseBody = null;
	if (responseText) {
		try {
			responseBody = JSON.parse(responseText);
		} catch {
			responseBody = responseText.slice(0, 500);
		}
	}

	if (!response.ok) {
		throw new GalleryApiError(
			`Gallery API request failed with HTTP ${response.status}`,
			response.status,
			responseBody
		);
	}
	return responseBody || {};
}

function appendOptional(form, name, value) {
	if (value !== undefined && value !== null && String(value).length > 0) {
		form.append(name, String(value));
	}
}

function createGalleryApi({
	baseUrl = process.env.GALLERY_API_BASE_URL || DEFAULT_BASE_URL,
	token = requireToken(),
	fetchImpl = fetch,
	timeoutMs = Number(process.env.GALLERY_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
	maxImageBytes = Number(process.env.GALLERY_MAX_IMAGE_BYTES) || DEFAULT_MAX_IMAGE_BYTES,
} = {}) {
	const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
	const importEndpoint = `${normalizedBaseUrl}/api/gallery/import/discord`;

	async function jsonRequest(url, options) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), timeoutMs);

		try {
			const response = await fetchImpl(url, {
				...options,
				signal: controller.signal,
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/json',
					...options.headers,
				},
			});
			return await parseResponse(response);
		} catch (error) {
			if (error.name === 'AbortError') {
				throw new GalleryApiError(`Gallery API request timed out after ${timeoutMs} ms`);
			}
			throw error;
		} finally {
			clearTimeout(timeout);
		}
	}

	return {
		async ingestImage(message, attachment) {
			if (attachment.size && attachment.size > maxImageBytes) {
				throw new GalleryApiError(
					`Discord image exceeds the configured ${maxImageBytes}-byte limit`
				);
			}

			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), timeoutMs);
			let discordResponse;

			try {
				discordResponse = await fetchImpl(attachment.url, { signal: controller.signal });
				if (!discordResponse.ok) {
					throw new GalleryApiError(
						`Could not download Discord image: HTTP ${discordResponse.status}`,
						discordResponse.status
					);
				}

				const form = new FormData();
				form.append('mediaKind', 'image');
				form.append('file', discordResponse.body, {
					filename: attachment.name || `discord-${attachment.id}`,
					contentType: attachment.contentType,
					...(attachment.size ? { knownLength: attachment.size } : {}),
				});
				form.append('attachmentId', String(attachment.id));
				form.append('guildId', String(message.guild.id));
				form.append('channelId', String(message.channel.id));
				form.append('messageId', String(message.id));
				form.append('authorId', String(message.author.id));
				form.append('messageUrl', message.url);
				appendOptional(
					form,
					'author',
					message.member?.displayName || message.author.globalName || message.author.username
				);
				appendOptional(form, 'username', message.author.username);
				appendOptional(form, 'channel', message.channel.name);
				appendOptional(form, 'message', message.content?.trim());
				appendOptional(form, 'createdAt', message.createdAt?.toISOString());

				const response = await fetchImpl(importEndpoint, {
					method: 'POST',
					signal: controller.signal,
					headers: {
						Authorization: `Bearer ${token}`,
						...form.getHeaders(),
					},
					body: form,
				});
				const result = await parseResponse(response);
				if (result.success !== true) {
					throw new GalleryApiError('Gallery image endpoint did not confirm success');
				}
				return result;
			} catch (error) {
				if (error.name === 'AbortError') {
					throw new GalleryApiError(`Gallery image upload timed out after ${timeoutMs} ms`);
				}
				throw error;
			} finally {
				clearTimeout(timeout);
				if (
					typeof discordResponse?.body?.destroy === 'function' &&
					!discordResponse.body.destroyed
				) {
					discordResponse.body.destroy();
				}
			}
		},

		reserveVideo(payload, idempotencyKey) {
			return jsonRequest(importEndpoint, {
				method: 'POST',
				headers: { 'Idempotency-Key': idempotencyKey },
				body: JSON.stringify(payload),
			});
		},

		updateVideo(submissionId, payload) {
			if (!submissionId) throw new GalleryApiError('Missing gallery submission ID');
			return jsonRequest(`${importEndpoint}/${encodeURIComponent(submissionId)}`, {
				method: 'PATCH',
				body: JSON.stringify(payload),
			});
		},
	};
}

let defaultApi;

function getDefaultApi() {
	if (!defaultApi) defaultApi = createGalleryApi();
	return defaultApi;
}

module.exports = {
	GalleryApiError,
	createGalleryApi,
	ingestImage: (...args) => getDefaultApi().ingestImage(...args),
	reserveVideo: (...args) => getDefaultApi().reserveVideo(...args),
	updateVideo: (...args) => getDefaultApi().updateVideo(...args),
};
