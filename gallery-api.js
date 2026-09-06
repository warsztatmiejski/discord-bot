const FormData = require('form-data');
const fetch = require('node-fetch');

const DEFAULT_BASE_URL = 'https://warsztatmiejski.org';
const DEFAULT_TIMEOUT_MS = 120_000;
const DEFAULT_MAX_IMAGE_BYTES = 20_000_000;
const DEFAULT_RETRY_COUNT = 2;
const DEFAULT_RETRY_DELAY_MS = 500;
const RETRYABLE_HTTP_STATUSES = new Set([502, 503, 504]);
const RETRYABLE_CONNECTION_CODES = new Set([
	'EAI_AGAIN',
	'ECONNABORTED',
	'ECONNREFUSED',
	'ECONNRESET',
	'ENETDOWN',
	'ENETUNREACH',
	'EPIPE',
	'ERR_STREAM_PREMATURE_CLOSE',
	'ETIMEDOUT',
	'UND_ERR_CONNECT_TIMEOUT',
	'UND_ERR_SOCKET',
]);

class GalleryApiError extends Error {
	constructor(message, status = null, responseBody = null, details = {}) {
		super(message);
		this.name = 'GalleryApiError';
		this.status = status;
		this.responseBody = responseBody;
		this.stage = details.stage || null;
		this.code = details.code || null;
		this.retryable = Boolean(details.retryable);
		this.attempts = details.attempts || 1;
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

function positiveNumber(value, fallback, { allowZero = false } = {}) {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	if (allowZero ? parsed < 0 : parsed <= 0) return fallback;
	return parsed;
}

function getErrorCode(error) {
	return error?.code || error?.cause?.code || null;
}

function isRetryableError(error) {
	if (error instanceof GalleryApiError) {
		return error.retryable || RETRYABLE_HTTP_STATUSES.has(error.status);
	}
	return RETRYABLE_CONNECTION_CODES.has(getErrorCode(error));
}

function describeRetry(error) {
	if (error?.status) return `HTTP ${error.status}`;
	if (error?.code) return error.code;
	return 'transient connection error';
}

function sleep(delayMs) {
	return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function readBodyWithLimit(body, maxBytes) {
	if (!body) throw new GalleryApiError('Discord returned an empty image body');
	if (Buffer.isBuffer(body)) {
		if (body.length === 0) throw new GalleryApiError('Discord returned an empty image body');
		if (body.length > maxBytes) {
			throw new GalleryApiError(`Downloaded Discord image exceeds the ${maxBytes}-byte limit`);
		}
		return body;
	}

	const chunks = [];
	let totalBytes = 0;
	for await (const value of body) {
		const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
		totalBytes += chunk.length;
		if (totalBytes > maxBytes) {
			if (typeof body.destroy === 'function') body.destroy();
			throw new GalleryApiError(`Downloaded Discord image exceeds the ${maxBytes}-byte limit`);
		}
		chunks.push(chunk);
	}
	if (totalBytes === 0) throw new GalleryApiError('Discord returned an empty image body');
	return Buffer.concat(chunks, totalBytes);
}

function createGalleryApi({
	baseUrl = process.env.GALLERY_API_BASE_URL || DEFAULT_BASE_URL,
	token = requireToken(),
	fetchImpl = fetch,
	timeoutMs = Number(process.env.GALLERY_API_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS,
	maxImageBytes = Number(process.env.GALLERY_MAX_IMAGE_BYTES) || DEFAULT_MAX_IMAGE_BYTES,
	downloadTimeoutMs = positiveNumber(
		process.env.GALLERY_IMAGE_DOWNLOAD_TIMEOUT_MS,
		timeoutMs
	),
	uploadTimeoutMs = positiveNumber(process.env.GALLERY_IMAGE_UPLOAD_TIMEOUT_MS, timeoutMs),
	retryCount = positiveNumber(process.env.GALLERY_API_RETRY_COUNT, DEFAULT_RETRY_COUNT, {
		allowZero: true,
	}),
	retryDelayMs = positiveNumber(
		process.env.GALLERY_API_RETRY_DELAY_MS,
		DEFAULT_RETRY_DELAY_MS,
		{ allowZero: true }
	),
	sleepImpl = sleep,
	logger = console,
} = {}) {
	const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
	const importEndpoint = `${normalizedBaseUrl}/api/gallery/import/discord`;

	async function withRetries(stage, operation) {
		const totalAttempts = Math.floor(retryCount) + 1;
		for (let attempt = 1; attempt <= totalAttempts; attempt += 1) {
			try {
				return await operation();
			} catch (error) {
				if (!isRetryableError(error) || attempt === totalAttempts) {
					if (error instanceof GalleryApiError) error.attempts = attempt;
					throw error;
				}
				const delayMs = retryDelayMs * (2 ** (attempt - 1));
				logger.warn?.(
					`[gallery-api] ${stage} attempt ${attempt}/${totalAttempts} failed (${describeRetry(error)}); retrying in ${delayMs} ms`
				);
				await sleepImpl(delayMs);
			}
		}
	}

	function connectionError(error, stage, label, timeout) {
		if (error instanceof GalleryApiError) {
			if (!error.stage) error.stage = stage;
			if (RETRYABLE_HTTP_STATUSES.has(error.status)) error.retryable = true;
			return error;
		}
		if (error?.name === 'AbortError') {
			return new GalleryApiError(`${label} timed out after ${timeout} ms`, null, null, {
				stage,
				code: 'ETIMEDOUT',
				retryable: true,
			});
		}
		const code = getErrorCode(error);
		return new GalleryApiError(`${label} failed due to a connection error`, null, null, {
			stage,
			code,
			retryable: RETRYABLE_CONNECTION_CODES.has(code),
		});
	}

	async function downloadImage(attachment) {
		return withRetries('download-discord-image', async () => {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), downloadTimeoutMs);
			let response;
			try {
				response = await fetchImpl(attachment.url, { signal: controller.signal });
				if (!response.ok) {
					throw new GalleryApiError(
						`Could not download Discord image: HTTP ${response.status}`,
						response.status,
						null,
						{
							stage: 'download-discord-image',
							retryable: RETRYABLE_HTTP_STATUSES.has(response.status),
						}
					);
				}

				const contentLength = Number(response.headers?.get?.('content-length'));
				if (Number.isFinite(contentLength) && contentLength > maxImageBytes) {
					throw new GalleryApiError(
						`Downloaded Discord image exceeds the ${maxImageBytes}-byte limit`,
						null,
						null,
						{ stage: 'download-discord-image' }
					);
				}
				return await readBodyWithLimit(response.body, maxImageBytes);
			} catch (error) {
				throw connectionError(
					error,
					'download-discord-image',
					'Discord image download',
					downloadTimeoutMs
				);
			} finally {
				clearTimeout(timeout);
				if (typeof response?.body?.destroy === 'function' && !response.body.destroyed) {
					response.body.destroy();
				}
			}
		});
	}

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

			const imageBuffer = await downloadImage(attachment);
			const form = new FormData();
			form.append('mediaKind', 'image');
			form.append('file', imageBuffer, {
				filename: attachment.name || `discord-${attachment.id}`,
				contentType: attachment.contentType,
				knownLength: imageBuffer.length,
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

			const multipartBody = form.getBuffer();
			const headers = {
				Authorization: `Bearer ${token}`,
				...form.getHeaders(),
				'Content-Length': String(multipartBody.length),
			};

			const result = await withRetries('upload-gallery-image', async () => {
				const controller = new AbortController();
				const timeout = setTimeout(() => controller.abort(), uploadTimeoutMs);
				try {
					const response = await fetchImpl(importEndpoint, {
						method: 'POST',
						signal: controller.signal,
						headers,
						body: multipartBody,
					});
					return await parseResponse(response);
				} catch (error) {
					throw connectionError(
						error,
						'upload-gallery-image',
						'Gallery image upload',
						uploadTimeoutMs
					);
				} finally {
					clearTimeout(timeout);
				}
			});
			if (result.success !== true) {
				throw new GalleryApiError(
					'Gallery image endpoint did not confirm success',
					null,
					result,
					{ stage: 'validate-gallery-response' }
				);
			}
			return result;
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
