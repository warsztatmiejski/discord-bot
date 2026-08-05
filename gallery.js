const fs = require('fs');
const path = require('path');

const {
	authorizeGoogleDrive,
	findFileByPropertyInFolder,
	getOrCreateFolderInDrive,
	uploadFileToGoogleDrive,
} = require('./googleDrive');
const {
	buildGalleryMetadata,
	isSupportedMediaAttachment,
} = require('./gallery-utils');

const CONFIG_PATH = path.resolve(__dirname, 'config.json');
const processingMessageIds = new Set();

function getGalleryConfig() {
	const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

	return {
		trusteeRoleId: config?.roleIds?.trustee || null,
		emojiName: config?.gallery?.emojiName || 'gallery',
		folderName: config?.gallery?.folderName || 'Galeria',
	};
}

async function addStatusReaction(message, emoji) {
	try {
		await message.react(emoji);
	} catch (error) {
		console.error(`Could not add gallery status reaction ${emoji}:`, error);
	}
}

async function handleGalleryReaction(reaction, user) {
	if (user.bot) return;

	let galleryConfig;
	try {
		galleryConfig = getGalleryConfig();
	} catch (error) {
		console.error('Could not read gallery configuration:', error);
		return;
	}

	if (reaction.emoji.name !== galleryConfig.emojiName) return;

	let message = reaction.message;
	try {
		if (reaction.partial) await reaction.fetch();
		if (message.partial) message = await message.fetch();
		if (!message.guild || !galleryConfig.trusteeRoleId) return;

		const reactingMember = await message.guild.members.fetch(user.id);
		if (!reactingMember.roles.cache.has(galleryConfig.trusteeRoleId)) return;

		const mediaAttachments = message.attachments.filter(isSupportedMediaAttachment);
		if (mediaAttachments.size === 0) return;

		const processingKey = `${message.guild.id}:${message.id}`;
		if (processingMessageIds.has(processingKey)) return;
		processingMessageIds.add(processingKey);

		try {
			const authClient = await authorizeGoogleDrive();
			const galleryFolder = await getOrCreateFolderInDrive(
				authClient,
				galleryConfig.folderName
			);

			let uploadedCount = 0;
			let existingCount = 0;

			for (const attachment of mediaAttachments.values()) {
				const existingFile = await findFileByPropertyInFolder(
					authClient,
					galleryFolder.id,
					'discordAttachmentId',
					attachment.id
				);

				if (existingFile) {
					existingCount += 1;
					continue;
				}

				const metadata = buildGalleryMetadata(message, attachment);
				await uploadFileToGoogleDrive(
					authClient,
					attachment.url,
					attachment.name || `discord-${attachment.id}`,
					galleryFolder.id,
					attachment.contentType || 'application/octet-stream',
					metadata.displayName,
					metadata.username,
					metadata
				);
				uploadedCount += 1;
			}

			console.log(
				`[gallery] message ${message.id}: uploaded ${uploadedCount}, already present ${existingCount}`
			);
			await addStatusReaction(message, '✅');
		} finally {
			processingMessageIds.delete(processingKey);
		}
	} catch (error) {
		console.error('Gallery upload failed:', error);
		await addStatusReaction(message, '❌');
	}
}

module.exports = {
	handleGalleryReaction,
};
