const test = require('node:test');
const assert = require('node:assert/strict');

const { createGalleryApi, GalleryApiError } = require('./gallery-api');

function response(status, body, extra = {}) {
	return {
		ok: status >= 200 && status < 300,
		status,
		text: async () => (body === undefined ? '' : JSON.stringify(body)),
		...extra,
	};
}

function abortablePendingResponse(signal) {
	return new Promise((_, reject) => {
		signal.addEventListener('abort', () => {
			const error = new Error('aborted');
			error.name = 'AbortError';
			reject(error);
		});
	});
}

test('downloads and forwards images as authenticated multipart forms', async () => {
	const requests = [];
	const api = createGalleryApi({
		baseUrl: 'https://gallery.example/',
		token: 'secret',
		fetchImpl: async (url, options = {}) => {
			requests.push({ url, options });
			if (url === 'https://cdn.example/photo.jpg') {
				return response(200, undefined, { body: Buffer.from('fake-jpeg') });
			}
			return response(201, {
				success: true,
				submissionId: 'item-1',
				status: 'published',
				suppressed: false,
			});
		},
	});
	const message = {
		id: '323456789012345678',
		url: 'https://discord.com/channels/123456789012345678/223456789012345678/323456789012345678',
		content: 'Budowa prototypu',
		createdAt: new Date('2026-09-04T10:00:00Z'),
		guild: { id: '123456789012345678' },
		channel: { id: '223456789012345678', name: 'projekty' },
		author: { id: '523456789012345678', username: 'kowalski' },
		member: { displayName: 'Jan Kowalski' },
	};

	const result = await api.ingestImage(message, {
		id: '423456789012345678',
		url: 'https://cdn.example/photo.jpg',
		name: 'photo.jpg',
		contentType: 'image/jpeg',
		size: 9,
	});

	assert.equal(result.success, true);
	assert.equal(requests[1].url, 'https://gallery.example/api/gallery/import/discord');
	assert.equal(requests[1].options.headers.Authorization, 'Bearer secret');
	assert.match(requests[1].options.headers['content-type'], /^multipart\/form-data; boundary=/);
	assert.ok(Buffer.isBuffer(requests[1].options.body));
	assert.equal(
		requests[1].options.headers['Content-Length'],
		String(requests[1].options.body.length)
	);
	const multipart = requests[1].options.body.toString('utf8');
	assert.match(multipart, /name="mediaKind"\r\n\r\nimage/);
	assert.match(multipart, /name="attachmentId"\r\n\r\n423456789012345678/);
	assert.match(multipart, /name="message"\r\n\r\nBudowa prototypu/);
	assert.match(multipart, /filename="photo.jpg"/);
	assert.match(multipart, /fake-jpeg/);
});

test('retries transient image uploads with the same buffered multipart body', async () => {
	const uploadRequests = [];
	const warnings = [];
	let downloads = 0;
	let uploads = 0;
	const api = createGalleryApi({
		baseUrl: 'https://gallery.example',
		token: 'secret',
		retryCount: 2,
		retryDelayMs: 10,
		sleepImpl: async () => {},
		logger: { warn: (message) => warnings.push(message) },
		fetchImpl: async (url, options = {}) => {
			if (url === 'https://cdn.example/photo.jpg') {
				downloads += 1;
				return response(200, undefined, { body: Buffer.from('complete-image') });
			}
			uploads += 1;
			uploadRequests.push(options);
			if (uploads === 1) {
				return response(503, { error: 'temporarily unavailable', stage: 'store-media' });
			}
			if (uploads === 2) {
				throw Object.assign(new Error('socket reset'), { code: 'ECONNRESET' });
			}
			return response(201, { success: true, submissionId: 'item-1' });
		},
	});

	const result = await api.ingestImage(
		{
			id: '323456789012345678',
			url: 'https://discord.com/channels/123456789012345678/223456789012345678/323456789012345678',
			guild: { id: '123456789012345678' },
			channel: { id: '223456789012345678', name: 'projekty' },
			author: { id: '523456789012345678', username: 'kowalski' },
		},
		{
			id: '423456789012345678',
			url: 'https://cdn.example/photo.jpg',
			name: 'photo.jpg',
			contentType: 'image/jpeg',
			size: 14,
		}
	);

	assert.equal(result.success, true);
	assert.equal(downloads, 1);
	assert.equal(uploads, 3);
	assert.equal(warnings.length, 2);
	assert.strictEqual(uploadRequests[0].body, uploadRequests[1].body);
	assert.strictEqual(uploadRequests[1].body, uploadRequests[2].body);
	assert.equal(
		uploadRequests[0].headers['Content-Length'],
		String(uploadRequests[0].body.length)
	);
});

test('does not retry permanent image API errors and preserves website diagnostics', async () => {
	let uploads = 0;
	const api = createGalleryApi({
		baseUrl: 'https://gallery.example',
		token: 'secret',
		retryCount: 2,
		sleepImpl: async () => {},
		fetchImpl: async (url) => {
			if (url === 'https://cdn.example/photo.jpg') {
				return response(200, undefined, { body: Buffer.from('complete-image') });
			}
			uploads += 1;
			return response(400, { error: 'invalid image', stage: 'read-file' });
		},
	});

	await assert.rejects(
		api.ingestImage(
			{
				id: '323456789012345678',
				url: 'https://discord.com/channels/123456789012345678/223456789012345678/323456789012345678',
				guild: { id: '123456789012345678' },
				channel: { id: '223456789012345678' },
				author: { id: '523456789012345678', username: 'kowalski' },
			},
			{
				id: '423456789012345678',
				url: 'https://cdn.example/photo.jpg',
				name: 'photo.jpg',
				contentType: 'image/jpeg',
				size: 14,
			}
		),
		(error) =>
			error instanceof GalleryApiError &&
			error.status === 400 &&
			error.stage === 'upload-gallery-image' &&
			error.responseBody.stage === 'read-file' &&
			error.attempts === 1
	);
	assert.equal(uploads, 1);
});

test('reports the Discord download stage when its independent timeout expires', async () => {
	const api = createGalleryApi({
		baseUrl: 'https://gallery.example',
		token: 'secret',
		downloadTimeoutMs: 5,
		retryCount: 0,
		fetchImpl: async (url, options) => abortablePendingResponse(options.signal),
	});

	await assert.rejects(
		api.ingestImage({}, { url: 'https://cdn.example/photo.jpg', size: 9 }),
		(error) =>
			error instanceof GalleryApiError &&
			error.stage === 'download-discord-image' &&
			error.code === 'ETIMEDOUT' &&
		/image download/.test(error.message)
	);
});

test('reports the gallery upload stage when its independent timeout expires', async () => {
	const api = createGalleryApi({
		baseUrl: 'https://gallery.example',
		token: 'secret',
		uploadTimeoutMs: 5,
		retryCount: 0,
		fetchImpl: async (url, options) => {
			if (url === 'https://cdn.example/photo.jpg') {
				return response(200, undefined, { body: Buffer.from('complete-image') });
			}
			return abortablePendingResponse(options.signal);
		},
	});

	await assert.rejects(
		api.ingestImage(
			{
				id: '323456789012345678',
				url: 'https://discord.com/channels/123456789012345678/223456789012345678/323456789012345678',
				guild: { id: '123456789012345678' },
				channel: { id: '223456789012345678' },
				author: { id: '523456789012345678', username: 'kowalski' },
			},
			{
				id: '423456789012345678',
				url: 'https://cdn.example/photo.jpg',
				name: 'photo.jpg',
				contentType: 'image/jpeg',
				size: 14,
			}
		),
		(error) =>
			error instanceof GalleryApiError &&
			error.stage === 'upload-gallery-image' &&
			error.code === 'ETIMEDOUT' &&
		/image upload/.test(error.message)
	);
});

test('reserves and updates videos at the JSON endpoint', async () => {
	const requests = [];
	const api = createGalleryApi({
		baseUrl: 'https://gallery.example',
		token: 'secret',
		fetchImpl: async (url, options) => {
			requests.push({ url, options });
			return response(200, { status: 'published' });
		},
	});

	await api.reserveVideo({ mediaKind: 'youtube_video' }, 'discord:m:a');
	await api.updateVideo('submission/1', { status: 'published' });

	assert.equal(requests[0].url, 'https://gallery.example/api/gallery/import/discord');
	assert.equal(requests[0].options.headers.Authorization, 'Bearer secret');
	assert.equal(requests[0].options.headers['Idempotency-Key'], 'discord:m:a');
	assert.equal(
		requests[1].url,
		'https://gallery.example/api/gallery/import/discord/submission%2F1'
	);
});

test('reports website API errors without leaking the token', async () => {
	const api = createGalleryApi({
		baseUrl: 'https://gallery.example',
		token: 'do-not-leak',
		fetchImpl: async () => response(422, { error: 'unsupported' }),
	});

	await assert.rejects(
		api.reserveVideo({}, 'key'),
		(error) =>
			error instanceof GalleryApiError &&
			error.status === 422 &&
			!error.message.includes('do-not-leak')
	);
});

test('rejects oversized images before downloading them', async () => {
	let called = false;
	const api = createGalleryApi({
		baseUrl: 'https://gallery.example',
		token: 'secret',
		maxImageBytes: 10,
		fetchImpl: async () => { called = true; },
	});

	await assert.rejects(
		api.ingestImage({}, { size: 11 }),
		/Discord image exceeds/
	);
	assert.equal(called, false);
});

test('rejects downloads whose actual bytes exceed the image limit', async () => {
	let calls = 0;
	const api = createGalleryApi({
		baseUrl: 'https://gallery.example',
		token: 'secret',
		maxImageBytes: 10,
		fetchImpl: async () => {
			calls += 1;
			return response(200, undefined, { body: Buffer.from('eleven-bytes') });
		},
	});

	await assert.rejects(
		api.ingestImage({}, { url: 'https://cdn.example/photo.jpg', size: 9 }),
		/Downloaded Discord image exceeds/
	);
	assert.equal(calls, 1);
});
