const test = require('node:test');
const assert = require('node:assert/strict');

const { createGalleryReactionHandler } = require('./gallery');

class AttachmentCollection extends Map {
	filter(predicate) {
		return new AttachmentCollection([...this].filter(([, value]) => predicate(value)));
	}
}

function createFixture(attachments, { messageId = 'message-1' } = {}) {
	const replies = [];
	const edits = [];
	const removedReactions = [];
	const message = {
		id: messageId,
		url: `https://discord.com/channels/guild-1/channel-1/${messageId}`,
		createdAt: new Date('2026-08-05T12:34:56.000Z'),
		content: 'Nowości z warsztatu',
		author: { id: 'author-1', username: 'maker' },
		member: { displayName: 'Local Maker' },
		channel: { id: 'channel-1', name: 'projekty' },
		guild: {
			id: 'guild-1',
			members: {
				fetch: async () => ({ roles: { cache: { has: () => true } } }),
			},
		},
		attachments: new AttachmentCollection(attachments.map((attachment) => [attachment.id, attachment])),
		reply: async ({ content }) => {
			replies.push(content);
			return {
				edit: async ({ content: editedContent }) => edits.push(editedContent),
			};
		},
	};
	const reaction = {
		emoji: { name: 'gallery' },
		message,
		users: { remove: async (userId) => removedReactions.push(userId) },
	};

	return { edits, message, reaction, removedReactions, replies };
}

function dependencies(overrides = {}) {
	let savedVideo = null;
	return {
		api: {
			ingestImage: async () => ({ success: true, item: {}, suppressed: false }),
			reserveVideo: async () => ({ submissionId: 'submission-1', status: 'pending' }),
			updateVideo: async () => ({}),
		},
		state: {
			getVideo: async () => savedVideo,
			updateVideo: async (attachmentId, updates) => {
				savedVideo = { ...savedVideo, ...updates };
				return savedVideo;
			},
		},
		youtubeClient: {
			uploadDiscordVideo: async () => ({ id: 'dQw4w9WgXcQ' }),
			waitForVideoReady: async () => ({ id: 'dQw4w9WgXcQ' }),
			addVideoToPlaylist: async () => ({
				playlistId: 'playlist-1',
				playlistItemId: 'playlist-item-1',
			}),
		},
		configProvider: () => ({ trusteeRoleId: 'trustee', emojiName: 'gallery' }),
		logger: { log() {}, error() {} },
		...overrides,
	};
}

test('sends images to the website without invoking YouTube', async () => {
	const fixture = createFixture([
		{
			id: 'image-1',
			name: 'photo.jpg',
			contentType: 'image/jpeg',
			size: 123,
			url: 'https://cdn.example/photo.jpg',
		},
	]);
	const ingestions = [];
	let youtubeCalled = false;
	const deps = dependencies({
		api: {
			ingestImage: async (message, attachment) => {
				ingestions.push({ message, attachment });
				return { success: true, item: {}, suppressed: true };
			},
			reserveVideo: async () => ({}),
			updateVideo: async () => ({}),
		},
		youtubeClient: {
			uploadDiscordVideo: async () => { youtubeCalled = true; },
			waitForVideoReady: async () => { youtubeCalled = true; },
			addVideoToPlaylist: async () => { youtubeCalled = true; },
		},
	});
	const handler = createGalleryReactionHandler(deps);

	await handler(fixture.reaction, { id: 'trustee-1', bot: false });

	assert.equal(ingestions.length, 1);
	assert.equal(ingestions[0].message.id, 'message-1');
	assert.equal(ingestions[0].attachment.id, 'image-1');
	assert.equal(youtubeCalled, false);
	assert.deepEqual(fixture.removedReactions, []);
	assert.deepEqual(fixture.replies, []);
	assert.deepEqual(fixture.edits, []);
});

test('serializes image ingestion across simultaneous gallery reactions', async () => {
	const first = createFixture([
		{
			id: 'image-1',
			name: 'first.jpg',
			contentType: 'image/jpeg',
			size: 123,
			url: 'https://cdn.example/first.jpg',
		},
	], { messageId: 'message-1' });
	const second = createFixture([
		{
			id: 'image-2',
			name: 'second.jpg',
			contentType: 'image/jpeg',
			size: 456,
			url: 'https://cdn.example/second.jpg',
		},
	], { messageId: 'message-2' });
	let activeIngestions = 0;
	let maximumConcurrentIngestions = 0;
	const completed = [];
	const deps = dependencies({
		api: {
			ingestImage: async (message) => {
				activeIngestions += 1;
				maximumConcurrentIngestions = Math.max(
					maximumConcurrentIngestions,
					activeIngestions
				);
				await new Promise((resolve) => setTimeout(resolve, 20));
				completed.push(message.id);
				activeIngestions -= 1;
				return { success: true, item: {}, suppressed: false };
			},
			reserveVideo: async () => ({}),
			updateVideo: async () => ({}),
		},
	});
	const handler = createGalleryReactionHandler(deps);

	await Promise.all([
		handler(first.reaction, { id: 'trustee-1', bot: false }),
		handler(second.reaction, { id: 'trustee-1', bot: false }),
	]);

	assert.equal(maximumConcurrentIngestions, 1);
	assert.deepEqual(completed, ['message-1', 'message-2']);
});

test('uploads videos, adds them to the playlist, and finalizes the website record', async () => {
	const fixture = createFixture([
		{
			id: 'video-1',
			name: 'clip.mp4',
			contentType: 'video/mp4',
			size: 456,
			url: 'https://cdn.example/clip.mp4',
		},
	]);
	const updates = [];
	const deps = dependencies();
	deps.api.updateVideo = async (id, payload) => updates.push({ id, payload });
	const handler = createGalleryReactionHandler(deps);

	await handler(fixture.reaction, { id: 'trustee-1', bot: false });

	assert.deepEqual(
		updates.map(({ payload }) => payload.status),
		['uploading', 'uploaded', 'playlist_added', 'published']
	);
	assert.equal(updates[3].payload.providerId, 'dQw4w9WgXcQ');
	assert.deepEqual(fixture.removedReactions, []);
	assert.deepEqual(fixture.replies, []);
	assert.deepEqual(fixture.edits, []);
});

test('resumes website finalization without uploading the same video again', async () => {
	const fixture = createFixture([
		{
			id: 'video-1',
			name: 'clip.mp4',
			contentType: 'video/mp4',
			size: 456,
			url: 'https://cdn.example/clip.mp4',
		},
	]);
	let savedVideo = {
		youtubeVideoId: 'youtube-existing',
		readyAt: '2026-08-05T12:40:00.000Z',
		playlistId: 'playlist-1',
		playlistItemId: 'playlist-item-1',
	};
	let youtubeCalled = false;
	const updates = [];
	const deps = dependencies({
		state: {
			getVideo: async () => savedVideo,
			updateVideo: async (attachmentId, values) => {
				savedVideo = { ...savedVideo, ...values };
				return savedVideo;
			},
		},
		youtubeClient: {
			uploadDiscordVideo: async () => { youtubeCalled = true; },
			waitForVideoReady: async () => { youtubeCalled = true; },
			addVideoToPlaylist: async () => { youtubeCalled = true; },
		},
	});
	deps.api.updateVideo = async (id, payload) => updates.push(payload);
	const handler = createGalleryReactionHandler(deps);

	await handler(fixture.reaction, { id: 'trustee-1', bot: false });

	assert.equal(youtubeCalled, false);
	assert.deepEqual(updates.map(({ status }) => status), ['uploading', 'published']);
	assert.equal(updates[1].providerId, 'youtube-existing');
});

test('does not restore or upload an already published archived video', async () => {
	const fixture = createFixture([
		{
			id: 'video-1',
			name: 'clip.mp4',
			contentType: 'video/mp4',
			size: 456,
			url: 'https://cdn.example/clip.mp4',
		},
	]);
	let youtubeCalled = false;
	const deps = dependencies({
		api: {
			ingestImage: async () => ({}),
			reserveVideo: async () => ({
				submissionId: 'submission-1',
				status: 'published',
				existing: true,
				archived: true,
				providerId: 'dQw4w9WgXcQ',
			}),
			updateVideo: async () => { throw new Error('must not update'); },
		},
		youtubeClient: {
			uploadDiscordVideo: async () => { youtubeCalled = true; },
			waitForVideoReady: async () => { youtubeCalled = true; },
			addVideoToPlaylist: async () => { youtubeCalled = true; },
		},
	});
	const handler = createGalleryReactionHandler(deps);

	await handler(fixture.reaction, { id: 'trustee-1', bot: false });

	assert.equal(youtubeCalled, false);
	assert.deepEqual(fixture.removedReactions, []);
	assert.deepEqual(fixture.replies, []);
	assert.deepEqual(fixture.edits, []);
});

test('removes the reaction and explains when every upload fails', async () => {
	const fixture = createFixture([
		{
			id: 'image-1',
			name: 'photo.jpg',
			contentType: 'image/jpeg',
			size: 123,
			url: 'https://cdn.example/photo.jpg',
		},
	]);
	const handler = createGalleryReactionHandler(dependencies({
		api: {
			ingestImage: async () => { throw new Error('website unavailable'); },
			reserveVideo: async () => ({}),
			updateVideo: async () => ({}),
		},
	}));

	await handler(fixture.reaction, { id: 'trustee-1', bot: false });

	assert.deepEqual(fixture.removedReactions, ['trustee-1']);
	assert.match(fixture.replies[0], /Nie udało się/);
	assert.match(fixture.replies[0], /Reakcję usunięto/);
});

test('removes the reaction and reports partial attachment failures without a success reply', async () => {
	const fixture = createFixture([
		{
			id: 'image-1',
			name: 'photo.jpg',
			contentType: 'image/jpeg',
			size: 123,
			url: 'https://cdn.example/photo.jpg',
		},
		{
			id: 'image-2',
			name: 'broken.jpg',
			contentType: 'image/jpeg',
			size: 456,
			url: 'https://cdn.example/broken.jpg',
		},
	]);
	const handler = createGalleryReactionHandler(dependencies({
		api: {
			ingestImage: async (message, attachment) => {
				if (attachment.id === 'image-2') throw new Error('website unavailable');
				return { success: true, item: {}, suppressed: false };
			},
			reserveVideo: async () => ({}),
			updateVideo: async () => ({}),
		},
	}));

	await handler(fixture.reaction, { id: 'trustee-1', bot: false });

	assert.deepEqual(fixture.removedReactions, ['trustee-1']);
	assert.equal(fixture.replies.length, 1);
	assert.match(fixture.replies[0], /1 pliku/);
	assert.doesNotMatch(fixture.replies[0], /Dodano do galerii/);
});

test('reports when Discord permissions prevent reaction removal', async () => {
	const fixture = createFixture([
		{
			id: 'image-1',
			name: 'photo.jpg',
			contentType: 'image/jpeg',
			size: 123,
			url: 'https://cdn.example/photo.jpg',
		},
	]);
	fixture.reaction.users.remove = async () => { throw new Error('missing permissions'); };
	const handler = createGalleryReactionHandler(dependencies({
		api: {
			ingestImage: async () => { throw new Error('website unavailable'); },
			reserveVideo: async () => ({}),
			updateVideo: async () => ({}),
		},
	}));

	await handler(fixture.reaction, { id: 'trustee-1', bot: false });

	assert.deepEqual(fixture.removedReactions, []);
	assert.match(fixture.replies[0], /Nie udało się usunąć reakcji/);
});
