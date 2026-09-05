function isSupportedMediaAttachment(attachment) {
	return getMediaKind(attachment) !== null;
}

function getMediaKind(attachment) {
	if (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(attachment.contentType)) {
		return 'image';
	}
	if (attachment.contentType?.startsWith('video/')) return 'youtube_video';
	return null;
}

function buildGalleryMetadata(message, attachment) {
	const displayName =
		message.member?.displayName ||
		message.author.globalName ||
		message.author.username;
	const channelName = message.channel.name || message.channel.id;

	return {
		displayName,
		username: message.author.username,
		description: `Discord: ${displayName} (@${message.author.username}), #${channelName}`,
		properties: {
			discordAuthorId: message.author.id,
			discordAuthorName: displayName,
			discordUsername: message.author.username,
			discordChannelId: message.channel.id,
			discordChannelName: channelName,
			discordGuildId: message.guild.id,
			discordMessageId: message.id,
			discordMessageUrl: message.url,
			discordCreatedAt: message.createdAt.toISOString(),
			discordAttachmentId: attachment.id,
		},
	};
}

function buildVideoReservation(message, attachment, ingestionVersion = 1) {
	const metadata = buildGalleryMetadata(message, attachment);
	const mediaKind = getMediaKind(attachment);

	if (mediaKind !== 'youtube_video') {
		throw new Error(`Not a supported Discord video: ${attachment.contentType}`);
	}

	return {
		mediaKind,
		ingestionVersion,
		source: {
			platform: 'discord',
			guildId: message.guild.id,
			channelId: message.channel.id,
			channelName: message.channel.name || message.channel.id,
			messageId: message.id,
			messageUrl: message.url,
			attachmentId: attachment.id,
			createdAt: message.createdAt.toISOString(),
		},
		author: {
			discordId: message.author.id,
			username: message.author.username,
			displayName: metadata.displayName,
		},
		asset: {
			filename: attachment.name || `discord-${attachment.id}`,
			contentType: attachment.contentType,
			size: attachment.size,
		},
	};
}

function buildYoutubeMetadata(message, attachment) {
	const metadata = buildGalleryMetadata(message, attachment);
	const messageTitle = message.content?.trim().split(/\r?\n/, 1)[0];
	const filenameTitle = (attachment.name || `Discord video ${attachment.id}`)
		.replace(/\.[^.]+$/, '')
		.trim();
	const title = (messageTitle || filenameTitle || `Discord video ${attachment.id}`)
		.slice(0, 100);
	const description = [
		`Autor: ${metadata.displayName} (@${metadata.username} na Discord)`,
		`Kanał: #${message.channel.name || message.channel.id}`,
		`Wiadomość źródłowa: ${message.url}`,
	].join('\n');

	return { title, description };
}

module.exports = {
	buildGalleryMetadata,
	buildVideoReservation,
	buildYoutubeMetadata,
	getMediaKind,
	isSupportedMediaAttachment,
};
