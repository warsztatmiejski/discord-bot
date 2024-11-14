// Media upload

const {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	StringSelectMenuBuilder,
} = require('discord.js');

const {
	authorizeGoogleDrive,
	uploadFileToGoogleDrive,
	listFoldersInDrive,
	createFolderInDrive,
	getFolderInfoById,
} = require('./googleDrive');

const MEDIA_CHANNEL_ID = process.env.MEDIA_CHANNEL_ID;

async function handleMediaMessage(client, message) {
	if (message.author.bot) return;

	// Only process messages from the specific channel
	if (message.channel.id !== MEDIA_CHANNEL_ID) return;

	// Check if the message has image or video attachments
	const mediaAttachments = message.attachments.filter((attachment) =>
		attachment.contentType &&
		(attachment.contentType.startsWith('image/') ||
			attachment.contentType.startsWith('video/'))
	);

	if (mediaAttachments.size > 0) {
		// Prompt the user for folder selection
		await promptUserForFolderSelection(message, mediaAttachments);
	}
}

async function promptUserForFolderSelection(message, mediaAttachments) {
	// Authorize Google Drive API
	let authClient;
	try {
		authClient = await authorizeGoogleDrive();
	} catch (error) {
		console.error('Authorization error:', error);
		await message.reply({
			content: 'Błąd autoryzacji.',
		});
		return;
	}

	// Fetch the list of folders in the shared drive
	let folders;
	try {
		folders = await listFoldersInDrive(authClient);
	} catch (error) {
		console.error('Error listing folders:', error);
		await message.reply({
			content: 'Nie można wylistować folderów.',
		});
		return;
	}

	// Prepare options for the select menu
	const folderOptions = folders.map((folder) => ({
		label: folder.name,
		value: folder.id,
	}));

	// Add an option to create a new folder
	folderOptions.unshift({
		label: 'Stwórz nowy folder',
		value: 'create_new_folder',
	});

	// Create a select menu for folder selection
	const selectMenu = new StringSelectMenuBuilder()
		.setCustomId(`folder_select|${message.id}|${message.author.id}`)
		.setPlaceholder('Wybierz folder')
		.addOptions(folderOptions);

	// Create a cancel button
	const cancelButton = new ButtonBuilder()
		.setCustomId(`upload_cancel|${message.id}|${message.author.id}`)
		.setLabel('Anuluj')
		.setStyle(ButtonStyle.Secondary);

	const row = new ActionRowBuilder().addComponents(selectMenu);
	const buttonRow = new ActionRowBuilder().addComponents(cancelButton);

	// Send the prompt in the channel and store the message
	const promptMessage = await message.reply({
		content: `${message.author}, wybierz folder aby skopiować swoje media:`,
		components: [row, buttonRow],
	});
}

async function handleMediaInteraction(client, interaction) {
	if (
		!interaction.isButton() &&
		!interaction.isStringSelectMenu() &&
		!interaction.isModalSubmit()
	)
		return;

	// Extract information from the custom ID
	const [action, messageId, userId] = interaction.customId.split('|');

	// Ensure only the original user can interact
	if (interaction.user.id !== userId) {
		await interaction.reply({
			content: 'Nie masz autoryzacji aby to zrobić.',
			ephemeral: true,
		});
		return;
	}

	// Handle folder selection
	if (action === 'folder_select') {
		const selectedFolderId = interaction.values[0];

		if (selectedFolderId === 'create_new_folder') {
			// Prompt user to enter a new folder name
			const modal = new ModalBuilder()
				.setCustomId(`create_folder_modal|${messageId}|${userId}`)
				.setTitle('Stwórz nowy folder');

			const folderNameInput = new TextInputBuilder()
				.setCustomId('new_folder_name')
				.setLabel('Nazwa folderu:')
				.setStyle(TextInputStyle.Short)
				.setRequired(true);

			const firstActionRow = new ActionRowBuilder().addComponents(folderNameInput);
			modal.addComponents(firstActionRow);

			await interaction.showModal(modal);
		} else {
			// Authorize Google Drive API
			let authClient;
			try {
				authClient = await authorizeGoogleDrive();
			} catch (error) {
				console.error('Authorization error:', error);
				await interaction.reply({
					content: 'Authorization error.',
					ephemeral: true,
				});
				return;
			}

			// Get the folder name
			let folderName = '';
			let folderLink = '';
			try {
				const folderInfo = await getFolderInfoById(authClient, selectedFolderId);
				  folderName = folderInfo.name;
				  folderLink = folderInfo.webViewLink;
			} catch (error) {
				console.error('Error fetching folder info:', error);
				await interaction.reply({
					content: 'Błąd pobierania danych folderu.',
					ephemeral: true,
				});
				return;
			}

			// Acknowledge the interaction and remove components
			await interaction.update({
				content: 'Wysyłam pliki...',
				components: [],
			});

			await uploadMediaToDrive(interaction, selectedFolderId, messageId, folderName, folderLink);
		}
	}

	// Handle cancel button
	if (action === 'upload_cancel') {
		await interaction.update({
			content: 'Anulowano.',
			components: [],
		});

		// Delete the original prompt message after a short delay
		setTimeout(() => {
			interaction.message.delete().catch(console.error);
		}, 5000); // Adjust the delay as needed
	}

	// Handle new folder creation modal submission
	else if (action === 'create_folder_modal') {
		const folderName = interaction.fields.getTextInputValue('new_folder_name');
		const messageId = messageId; // Ensure messageId is defined from the split

		// Authorize Google Drive API
		let authClient;
		try {
			authClient = await authorizeGoogleDrive();
		} catch (error) {
			console.error('Authorization error:', error);
			await interaction.reply({
				content: 'Błąd autoryzacji.',
				ephemeral: true,
			});
			return;
		}

		// Create the new folder
		let newFolder;
		try {
			newFolder = await createFolderInDrive(authClient, folderName);
			const folderLink = newFolder.webViewLink;
		} catch (error) {
			console.error('Error creating folder:', error);
			await interaction.reply({
				content: 'Error creating folder.',
				ephemeral: true,
			});
			return;
		}

		// Proceed to upload media to the new folder
		await interaction.deferReply({ ephemeral: true });
		await uploadMediaToDrive(interaction, newFolder.id, messageId, folderName, folderLink);
	}

}

async function uploadMediaToDrive(interaction, folderId, originalMessageId, folderName, folderLink) {
	// Retrieve the original message from the guild channel
	let message;
	try {
		const channel = await interaction.client.channels.fetch(interaction.channelId);
		message = await channel.messages.fetch(originalMessageId);
	} catch (error) {
		console.error('Error fetching original message:', error);
		await interaction.followUp({
			content: 'Error fetching original message.',
			ephemeral: true,
		});
		return;
	}

	const mediaAttachments = message.attachments.filter((attachment) =>
		attachment.contentType &&
		(attachment.contentType.startsWith('image/') ||
			attachment.contentType.startsWith('video/'))
	);

	if (mediaAttachments.size === 0) {
		await message.reply({
			content: 'Brak mediów.',
		});
		return;
	}

	// Authorize Google Drive API
	let authClient;
	try {
		authClient = await authorizeGoogleDrive();
	} catch (error) {
		console.error('Authorization error:', error);
		await message.reply({
			content: 'Błąd autoryzacji.',
		});
		return;
	}

	// Get uploader's display name and username
	const displayName = message.member ? message.member.displayName : message.author.username;
	const username = message.author.username;

	// Upload each media file
	for (const attachment of mediaAttachments.values()) {
		try {
			const mediaUrl = attachment.url;
			const fileName = attachment.name;
			const mimeType = attachment.contentType || 'application/octet-stream';

			// Upload to Google Drive
			await uploadFileToGoogleDrive(
				authClient,
				mediaUrl,
				fileName,
				folderId,
				mimeType,
				displayName,
				username
			);
		} catch (error) {
			console.error('Error uploading media:', error);
			await message.reply({
				content: 'Błąd wysyłania plików.',
			});
			return;
		}
	}

	// Send the confirmation message as a reply to the original media message
	await message.reply({
		content: `Media zapisane na dysku Google w [Social Media/${folderName}](${folderLink}).`,
	});

	// Delete the interaction reply if necessary
	if (interaction.deferred || interaction.replied) {
		try {
			await interaction.deleteReply();
		} catch (error) {
			console.error('Error deleting interaction reply:', error);
		}
	}

	// Delete the original prompt message after a short delay
	setTimeout(() => {
		interaction.message.delete().catch(console.error);
	}, 5000); // Adjust the delay as needed
}

module.exports = {
	handleMediaMessage,
	handleMediaInteraction,
};