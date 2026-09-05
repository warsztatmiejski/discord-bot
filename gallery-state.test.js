const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { createGalleryState } = require('./gallery-state');

test('persists YouTube upload state across instances', async (t) => {
	const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'gallery-state-test-'));
	t.after(() => fs.promises.rm(directory, { recursive: true, force: true }));
	const statePath = path.join(directory, 'state.json');
	const first = createGalleryState(statePath);

	await first.updateVideo('attachment-1', { youtubeVideoId: 'video-1', status: 'uploaded' });
	await first.updateVideo('attachment-1', { playlistItemId: 'playlist-item-1' });

	const second = createGalleryState(statePath);
	const saved = await second.getVideo('attachment-1');
	assert.equal(saved.youtubeVideoId, 'video-1');
	assert.equal(saved.playlistItemId, 'playlist-item-1');
	assert.equal(saved.status, 'uploaded');
});
