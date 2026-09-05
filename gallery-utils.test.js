const test = require('node:test');
const assert = require('node:assert/strict');

const {
	buildGalleryMetadata,
	buildVideoReservation,
	buildYoutubeMetadata,
	getMediaKind,
	isSupportedMediaAttachment,
} = require('./gallery-utils');

test('accepts images and videos, but rejects other attachments', () => {
	assert.equal(isSupportedMediaAttachment({ contentType: 'image/jpeg' }), true);
	assert.equal(isSupportedMediaAttachment({ contentType: 'video/mp4' }), true);
	assert.equal(isSupportedMediaAttachment({ contentType: 'application/pdf' }), false);
	assert.equal(isSupportedMediaAttachment({ contentType: 'image/svg+xml' }), false);
	assert.equal(isSupportedMediaAttachment({ contentType: null }), false);
	assert.equal(getMediaKind({ contentType: 'image/png' }), 'image');
	assert.equal(getMediaKind({ contentType: 'video/quicktime' }), 'youtube_video');
});

test('builds editable Drive metadata from the Discord message', () => {
	const message = {
		id: 'message-1',
		url: 'https://discord.com/channels/guild-1/channel-1/message-1',
		createdAt: new Date('2026-08-05T12:34:56.000Z'),
		author: {
			id: 'author-1',
			username: 'maker',
			globalName: 'Global Maker',
		},
		member: { displayName: 'Local Maker' },
		channel: { id: 'channel-1', name: 'projekty' },
		guild: { id: 'guild-1' },
	};

	const metadata = buildGalleryMetadata(message, { id: 'attachment-1' });

	assert.equal(metadata.displayName, 'Local Maker');
	assert.equal(metadata.username, 'maker');
	assert.equal(metadata.properties.discordAuthorId, 'author-1');
	assert.equal(metadata.properties.discordChannelName, 'projekty');
	assert.equal(metadata.properties.discordMessageId, 'message-1');
	assert.equal(metadata.properties.discordAttachmentId, 'attachment-1');
	assert.equal(metadata.properties.discordCreatedAt, '2026-08-05T12:34:56.000Z');
});

test('builds a video reservation and YouTube metadata', () => {
	const message = {
		id: 'message-1',
		url: 'https://discord.com/channels/guild-1/channel-1/message-1',
		createdAt: new Date('2026-08-05T12:34:56.000Z'),
		content: 'Film z warsztatu',
		author: { id: 'author-1', username: 'maker' },
		member: { displayName: 'Local Maker' },
		channel: { id: 'channel-1', name: 'projekty' },
		guild: { id: 'guild-1' },
	};
	const video = buildVideoReservation(message, {
		id: 'video-1',
		name: 'clip.mp4',
		contentType: 'video/mp4',
		size: 456,
		url: 'https://cdn.example/clip.mp4',
	});

	assert.equal(video.mediaKind, 'youtube_video');
	assert.equal(video.asset.url, undefined);
	assert.equal(video.source.attachmentId, 'video-1');
	assert.deepEqual(buildYoutubeMetadata(message, video.asset), {
		title: 'Film z warsztatu',
		description:
			'Autor: Local Maker (@maker na Discord)\nKanał: #projekty\nWiadomość źródłowa: https://discord.com/channels/guild-1/channel-1/message-1',
	});
});
