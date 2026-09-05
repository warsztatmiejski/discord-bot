const test = require('node:test');
const assert = require('node:assert/strict');

const { createGalleryReactionHandler } = require('./gallery');

class AttachmentCollection extends Map {
	filter(predicate) {
		return new AttachmentCollection([...this].filter(([, value]) => predicate(value)));
	}
}

function createFixture(attachments) {
	const replies = [];
	const edits = [];
	const removedReactions = [];
	const message = {
		id: 'message-1',
		url: 'https://discord.com/channels/guild-1/channel-1/message-1',
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
	assert.match(fixture.edits[0], /youtube\.com\/watch\?v=dQw4w9WgXcQ/);
	assert.deepEqual(fixture.removedReactions, []);
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
	assert.match(fixture.edits[0], /dQw4w9WgXcQ/);
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
});
