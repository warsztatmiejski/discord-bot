const test = require('node:test');
const assert = require('node:assert/strict');

const {
	buildGalleryMetadata,
	isSupportedMediaAttachment,
} = require('./gallery-utils');

test('accepts images and videos, but rejects other attachments', () => {
	assert.equal(isSupportedMediaAttachment({ contentType: 'image/jpeg' }), true);
	assert.equal(isSupportedMediaAttachment({ contentType: 'video/mp4' }), true);
	assert.equal(isSupportedMediaAttachment({ contentType: 'application/pdf' }), false);
	assert.equal(isSupportedMediaAttachment({ contentType: null }), false);
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
