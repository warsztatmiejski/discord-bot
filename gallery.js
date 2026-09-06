const fs = require('fs');
const path = require('path');

const galleryApi = require('./gallery-api');
const galleryState = require('./gallery-state');
const {
	buildYoutubeMetadata,
	buildVideoReservation,
	getMediaKind,
	isSupportedMediaAttachment,
} = require('./gallery-utils');
const youtube = require('./youtube');

const CONFIG_PATH = path.resolve(__dirname, 'config.json');

function getGalleryConfig() {
	const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

	return {
		trusteeRoleId: config?.roleIds?.trustee || null,
		emojiName: config?.gallery?.emojiName || 'gallery',
	};
}

async function removeGalleryReaction(reaction, userId, logger = console) {
	try {
		await reaction.users.remove(userId);
		return true;
	} catch (error) {
		logger.error('Could not remove failed gallery reaction:', error);
		return false;
	}
}

async function sendMessage(message, content, logger = console) {
	try {
		return await message.reply({ content });
	} catch (error) {
		logger.error('Could not send gallery status message:', error);
		return null;
	}
}

async function bestEffortSubmissionUpdate(api, submissionId, payload, logger) {
	if (!submissionId) return;
	try {
		await api.updateVideo(submissionId, payload);
	} catch (error) {
		logger.error(`Could not update gallery submission ${submissionId}:`, error);
	}
}

function createGalleryReactionHandler({
	api = galleryApi,
	state = galleryState,
	youtubeClient = youtube,
	configProvider = getGalleryConfig,
	logger = console,
} = {}) {
	const processingMessageIds = new Set();

	async function processImage(message, attachment) {
		const result = await api.ingestImage(message, attachment);

		return {
			kind: 'image',
			existing: Boolean(result.suppressed),
			suppressed: Boolean(result.suppressed),
			url: result.item?.url || null,
		};
	}

	async function processVideo(message, attachment) {
		const payload = buildVideoReservation(message, attachment);
		const idempotencyKey = `discord:${message.id}:${attachment.id}`;
		const reservation = await api.reserveVideo(payload, idempotencyKey);

		if (reservation.status === 'published' && reservation.providerId) {
			return {
				kind: 'youtube_video',
				existing: true,
				url: reservation.url || `https://www.youtube.com/watch?v=${reservation.providerId}`,
			};
		}

		const submissionId = reservation.submissionId;
		if (!submissionId) throw new Error('Gallery API did not return a submission ID for a video');

		let savedVideo = await state.getVideo(attachment.id);
		await state.updateVideo(attachment.id, { submissionId, idempotencyKey });
		await api.updateVideo(submissionId, { status: 'uploading' });

		let failureCode = 'youtube_upload_failed';
		try {
			if (!savedVideo?.youtubeVideoId) {
				const uploadedVideo = await youtubeClient.uploadDiscordVideo({
					mediaUrl: attachment.url,
					mimeType: attachment.contentType,
					size: attachment.size,
					metadata: buildYoutubeMetadata(message, attachment),
				});
				savedVideo = await state.updateVideo(attachment.id, {
					youtubeVideoId: uploadedVideo.id,
					status: 'uploaded',
				});
				await bestEffortSubmissionUpdate(
					api,
					submissionId,
					{ status: 'uploaded' },
					logger
				);
			}

			failureCode = 'youtube_processing_failed';
			if (!savedVideo.readyAt) {
				await youtubeClient.waitForVideoReady(savedVideo.youtubeVideoId);
				savedVideo = await state.updateVideo(attachment.id, {
					readyAt: new Date().toISOString(),
					status: 'processed',
				});
			}

			failureCode = 'youtube_playlist_failed';
			if (!savedVideo.playlistItemId) {
				const playlist = await youtubeClient.addVideoToPlaylist(savedVideo.youtubeVideoId);
				savedVideo = await state.updateVideo(attachment.id, {
					...playlist,
					status: 'playlist_added',
				});
				await bestEffortSubmissionUpdate(
					api,
					submissionId,
					{ status: 'playlist_added' },
					logger
				);
			}

			failureCode = 'gallery_finalize_failed';
			const url = `https://www.youtube.com/watch?v=${savedVideo.youtubeVideoId}`;
			await api.updateVideo(submissionId, {
				status: 'published',
				provider: 'youtube',
				providerId: savedVideo.youtubeVideoId,
				url,
				playlistId: savedVideo.playlistId,
				playlistItemId: savedVideo.playlistItemId,
				title: buildYoutubeMetadata(message, attachment).title,
			});
			try {
				await state.updateVideo(attachment.id, { status: 'published' });
			} catch (error) {
				logger.error(`Could not persist published state for ${attachment.id}:`, error);
			}

			return { kind: 'youtube_video', existing: false, url };
		} catch (error) {
			await bestEffortSubmissionUpdate(
				api,
				submissionId,
				{ status: 'failed', errorCode: failureCode },
				logger
			);
			await state.updateVideo(attachment.id, {
				status: 'failed',
				failureCode,
			});
			throw error;
		}
	}

	return async function handleGalleryReaction(reaction, user) {
		if (user.bot) return;

		let galleryConfig;
		try {
			galleryConfig = configProvider();
		} catch (error) {
			logger.error('Could not read gallery configuration:', error);
			return;
		}

		if (reaction.emoji.name !== galleryConfig.emojiName) return;

		let message = reaction.message;
		try {
			if (reaction.partial) {
				await reaction.fetch();
				message = reaction.message;
			}
			if (message.partial) message = await message.fetch();
			if (!message.guild || !galleryConfig.trusteeRoleId) return;

			const reactingMember = await message.guild.members.fetch(user.id);
			if (!reactingMember.roles.cache.has(galleryConfig.trusteeRoleId)) return;

			const mediaAttachments = message.attachments.filter(isSupportedMediaAttachment);
			if (mediaAttachments.size === 0) return;

			const processingKey = `${message.guild.id}:${message.id}`;
			if (processingMessageIds.has(processingKey)) return;
			processingMessageIds.add(processingKey);

			const successes = [];
			const failures = [];

			try {
				for (const attachment of mediaAttachments.values()) {
					try {
						const kind = getMediaKind(attachment);
						const result = kind === 'image'
							? await processImage(message, attachment)
							: await processVideo(message, attachment);
						successes.push({ attachment, ...result });
					} catch (error) {
						failures.push({ attachment, error });
						logger.error(`[gallery] attachment ${attachment.id} failed:`, error);
					}
				}

				if (failures.length > 0) {
					const reactionRemoved = await removeGalleryReaction(reaction, user.id, logger);
					const scope = successes.length > 0
						? `Nie udało się dodać ${failures.length} ${failures.length === 1 ? 'pliku' : 'plików'} do galerii.`
						: 'Nie udało się dodać mediów do galerii.';
					const retry = reactionRemoved
						? 'Reakcję usunięto — spróbuj ponownie później.'
						: 'Nie udało się usunąć reakcji — usuń ją ręcznie przed ponowną próbą.';
					await sendMessage(message, `❌ ${scope} ${retry}`, logger);
				}

				logger.log(
					`[gallery] message ${message.id}: succeeded ${successes.length}, failed ${failures.length}`
				);
			} finally {
				processingMessageIds.delete(processingKey);
			}
		} catch (error) {
			logger.error('Gallery reaction handling failed:', error);
			const reactionRemoved = await removeGalleryReaction(reaction, user.id, logger);
			const retry = reactionRemoved
				? 'Reakcję usunięto — spróbuj ponownie później.'
				: 'Nie udało się usunąć reakcji — usuń ją ręcznie przed ponowną próbą.';
			await sendMessage(message, `❌ Nie udało się dodać mediów do galerii. ${retry}`, logger);
		}
	};
}

const handleGalleryReaction = createGalleryReactionHandler();

module.exports = {
	createGalleryReactionHandler,
	getGalleryConfig,
	handleGalleryReaction,
};
