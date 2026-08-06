function isSupportedMediaAttachment(attachment) {
	return Boolean(
		attachment.contentType &&
			(attachment.contentType.startsWith('image/') ||
				attachment.contentType.startsWith('video/'))
	);
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

module.exports = {
	buildGalleryMetadata,
	isSupportedMediaAttachment,
};
