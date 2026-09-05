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
	const multipart = requests[1].options.body.getBuffer().toString('utf8');
	assert.match(multipart, /name="mediaKind"\r\n\r\nimage/);
	assert.match(multipart, /name="attachmentId"\r\n\r\n423456789012345678/);
	assert.match(multipart, /name="message"\r\n\r\nBudowa prototypu/);
	assert.match(multipart, /filename="photo.jpg"/);
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
