const fs = require('fs');
const path = require('path');

const DEFAULT_STATE_PATH = path.resolve(__dirname, 'gallery-upload-state.json');

function createGalleryState(statePath = process.env.GALLERY_STATE_PATH || DEFAULT_STATE_PATH) {
	let loaded = false;
	let state = { videos: {} };
	let pendingWrite = Promise.resolve();

	async function load() {
		if (loaded) return;
		try {
			state = JSON.parse(await fs.promises.readFile(statePath, 'utf8'));
			if (!state.videos || typeof state.videos !== 'object') state.videos = {};
		} catch (error) {
			if (error.code !== 'ENOENT') throw error;
		}
		loaded = true;
	}

	async function persist() {
		await fs.promises.mkdir(path.dirname(statePath), { recursive: true });
		const temporaryPath = `${statePath}.${process.pid}.tmp`;
		await fs.promises.writeFile(temporaryPath, JSON.stringify(state, null, 2), {
			mode: 0o600,
		});
		await fs.promises.rename(temporaryPath, statePath);
	}

	function queuePersist() {
		pendingWrite = pendingWrite.then(persist, persist);
		return pendingWrite;
	}

	return {
		async getVideo(attachmentId) {
			await load();
			return state.videos[attachmentId] || null;
		},

		async updateVideo(attachmentId, updates) {
			await load();
			state.videos[attachmentId] = {
				...state.videos[attachmentId],
				...updates,
				updatedAt: new Date().toISOString(),
			};
			await queuePersist();
			return state.videos[attachmentId];
		},
	};
}

let defaultState;

function getDefaultState() {
	if (!defaultState) defaultState = createGalleryState();
	return defaultState;
}

module.exports = {
	createGalleryState,
	getVideo: (...args) => getDefaultState().getVideo(...args),
	updateVideo: (...args) => getDefaultState().updateVideo(...args),
};
