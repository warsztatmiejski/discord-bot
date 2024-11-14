// interactions.js
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
	authorize,
	uploadMediaToGooglePhotos,
	listAlbums,
	createAlbum,
} = require('./googlePhotos');

const keywordResponses = [{
		keywords: ['młotek'],
		response: "_Wlazł kotek na płotek i upuścił młotek_ 😱 Pamiętaj, robienie zbyt wielu rzeczy jednocześnie zazwyczaj źle się kończy.",
	},
	{
		keywords: ['piła'],
		response: "_Piła piła, aż się upiła_ 🥴 Do pracy zawsze przychodź trzeźwy!",
	},
	{
		keywords: ['dziura', 'dziury'],
		response: "Do zalepienia dziury wystarczy trochę czekolady i kwasu siarkowego.",
	},
	{
		keywords: ['problem'],
		response: "_Problemem nie jest problem. Problemem jest twoje nastawienie do problemu._ Kapitan Jack Sparrow",
	},
	{
		keywords: ['zrobię', 'mogę zrobić'],
		response: "_Obiecanki cacanki, a głupiemu radość_ 🤡 Zastanów się czy na pewno dasz radę to zrobić? Potem już nikt ci nie uwierzy.",
	},
	// Add more keyword responses as needed
];

const keywordCooldowns = new Map();
const COOLDOWN_TIME = 24 * 60 * 60 * 1000; // 24 hours

async function handleMessageCreate(client, message) {
	if (message.author.bot) return;

	// Handle keyword responses
	for (const { keywords, response } of keywordResponses) {
		// Create a regex pattern that matches any of the keywords/phrases
		const pattern = keywords
			.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('|');
		const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');

		if (regex.test(message.content)) {
			// Check cooldown for this response
			const lastResponseTime = keywordCooldowns.get(response) || 0;
			const currentTime = Date.now();

			if (currentTime - lastResponseTime < COOLDOWN_TIME) {
				// Cooldown period has not passed; do not respond
				console.log(`Cooldown active for response. Skipping.`);
				break;
			}

			try {
				// Highlight the matched keyword/phrase in the original message
				const highlightedMessage = message.content.replace(regex, '**$1**');

				// Send the response, quoting the original message
				await message.channel.send({
					content: `> ${highlightedMessage}\n\n${response}`,
				});

				// Update the cooldown for this response
				keywordCooldowns.set(response, currentTime);
			} catch (error) {
				console.error(`Error responding to message: ${error}`);
			}
			break; // Exit after handling one response
		}
	}

	// Check if the message has image or video attachments
	const mediaAttachments = message.attachments.filter((attachment) =>
		attachment.contentType &&
		(attachment.contentType.startsWith('image/') ||
			attachment.contentType.startsWith('video/'))
	);

	if (mediaAttachments.size > 0) {
		// Prompt the user for confirmation
		await promptUserForUpload(message, mediaAttachments);
	}
}

async function promptUserForUpload(message, mediaAttachments) {
	// Create buttons for Yes and No options
	const row = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
		.setCustomId(`upload|yes|${message.channel.id}|${message.id}`)
		.setLabel('Wyślij do Google Photos')
		.setStyle(ButtonStyle.Primary),
		new ButtonBuilder()
		.setCustomId('upload|no')
		.setLabel('Nie wysyłaj')
		.setStyle(ButtonStyle.Secondary)
	);

	try {
		// Send a DM to the user
		//const dmChannel = await message.author.createDM();
		//await dmChannel.send({
		await message.author.send({
			content: `Hej ${message.author}, czy chcesz wysłać plik do Google Photos?`,
			components: [row],
		});
	} catch (error) {
		console.error('Error sending DM:', error);
		// Optionally notify the user in the channel if DMs are disabled
		await message.reply({
			content: `${message.author}, nie mogę Ci nic wysłać na priv. Włącz prywatne wiadomości dla użytkowników serwera.`,
		});
	}
}

// Suggest album name based on channel name
function suggestAlbumName(channelName) {
	return channelName
		.replace(/-/g, ' ')
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

async function handleInteraction(client, interaction) {
	if (interaction.isCommand()) {
		// Handle slash commands
		if (interaction.commandName === 'ludzie') {
			const memberCount = interaction.guild.memberCount;
			await interaction.reply(
				`Liczba użytkowników na serwerze: ${memberCount}`
			);
		}
		return;
	}

	if (
		!interaction.isButton() &&
		!interaction.isStringSelectMenu() &&
		!interaction.isModalSubmit()
	)
		return;

	// Extract information from the custom ID
	const parts = interaction.customId.split('|');

	// Handle the 'Upload to Google Photos' button
	if (parts[0] === 'upload' && parts[1] === 'yes') {
		const channelId = parts[2];
		const messageId = parts[3];

		// Authorize Google Photos API
		let authClient;
		try {
			authClient = await authorize();
		} catch (error) {
			console.error('Authorization error:', error);
			await interaction.reply({
				content: 'Błąd autoryzacji.',
				ephemeral: true,
			});
			return;
		}

		// Fetch the list of albums created by the app
		let albums;
		try {
			albums = await listAlbums(authClient);
		} catch (error) {
			console.error('Error listing albums:', error);
			await interaction.reply({
				content: 'Nie można wylistować albumów.',
				ephemeral: true,
			});
			return;
		}

		// Prepare options for the select menu
		const albumOptions = albums.map((album) => ({
			label: album.title,
			value: album.id,
		}));

		// Add an option to create a new album
		albumOptions.unshift({
			label: 'Utwórz nowy album',
			value: 'create_new_album',
		});

		// Create a select menu for album selection
		const selectMenu = new StringSelectMenuBuilder()
			.setCustomId(`album_select|${channelId}|${messageId}`)
			.setPlaceholder('Wybierz album')
			.addOptions(albumOptions);

		const row = new ActionRowBuilder().addComponents(selectMenu);

		// Send the select menu to the user
		await interaction.reply({
			content: 'Wybierz album do wysłania plików:',
			components: [row],
			ephemeral: true,
		});
	}

	// Handle the 'Do Not Upload' button
	else if (interaction.customId === 'upload|no') {
		await interaction.update({
			content: 'Twoje pliki nie zostaną wysłane.',
			components: [],
		});
	}

	// Handle album selection
	else if (interaction.customId.startsWith('album_select|')) {
		const [, channelId, messageId] = interaction.customId.split('|');
		const selectedAlbumId = interaction.values[0];

		if (selectedAlbumId === 'create_new_album') {
			// Suggest a default album name based on channel name
			let channelName = 'Bez nazwy';
			try {
				const channel = await client.channels.fetch(channelId);
				channelName = channel.name;
			} catch (error) {
				console.error('Error fetching channel:', error);
			}

			const defaultAlbumName = suggestAlbumName(channelName);

			// Prompt user to enter a new album name
			const modal = new ModalBuilder()
				.setCustomId(`create_album_modal|${channelId}|${messageId}`)
				.setTitle('Utwórz nowy album');

			const albumNameInput = new TextInputBuilder()
				.setCustomId('new_album_name')
				.setLabel('Wpisz nazwę nowego albumu:')
				.setStyle(TextInputStyle.Short)
				.setRequired(true)
				.setPlaceholder(defaultAlbumName);

			const firstActionRow = new ActionRowBuilder().addComponents(albumNameInput);
			modal.addComponents(firstActionRow);

			await interaction.showModal(modal);
		} else {
			// Proceed to upload media to the selected album
			await interaction.deferReply({ ephemeral: true });
			await uploadMedia(interaction, selectedAlbumId, channelId, messageId);
		}
	}

	// Handle new album creation modal submission
	else if (interaction.customId.startsWith('create_album_modal|')) {
		const [, channelId, messageId] = interaction.customId.split('|');
		const albumName = interaction.fields.getTextInputValue('new_album_name');

		// Authorize Google Photos API
		let authClient;
		try {
			authClient = await authorize();
		} catch (error) {
			console.error('Authorization error:', error);
			await interaction.reply({
				content: 'Błąd autoryzacji.',
				ephemeral: true,
			});
			return;
		}

		// Create the new album
		let newAlbum;
		try {
			newAlbum = await createAlbum(authClient, albumName);
		} catch (error) {
			console.error('Error creating album:', error);
			await interaction.reply({
				content: 'Błąd przy tworzeniu albumu.',
				ephemeral: true,
			});
			return;
		}

		// Proceed to upload media to the new album
		await interaction.deferReply({ ephemeral: true });
		await uploadMedia(interaction, newAlbum.id, channelId, messageId);
	}
}

async function uploadMedia(interaction, albumId, channelId, messageId) {
	// Retrieve the original message from the guild channel
	let message;
	try {
		const channel = await interaction.client.channels.fetch(channelId);
		message = await channel.messages.fetch(messageId);
	} catch (error) {
		console.error('Error fetching original message:', error);
		await interaction.editReply({
			content: 'Bład pobierania oryginalnej wiadomości.',
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
		await interaction.editReply({
			content: 'Brak mediów do wysłania.',
			ephemeral: true,
		});
		return;
	}

	// Authorize Google Photos API
	let authClient;
	try {
		authClient = await authorize();
	} catch (error) {
		console.error('Authorization error:', error);
		await interaction.editReply({
			content: 'Błąd autoryzacji.',
			ephemeral: true,
		});
		return;
	}

	// Upload each media file
	for (const attachment of mediaAttachments.values()) {
		try {
			const mediaUrl = attachment.url;
			const fileName = attachment.name;

			// Upload to Google Photos
			await uploadMediaToGooglePhotos(authClient, mediaUrl, fileName, albumId);
		} catch (error) {
			console.error('Error uploading media:', error);
			await interaction.editReply({
				content: 'Błąd wysyłania plików.',
				ephemeral: true,
			});
			return;
		}
	}

	await interaction.editReply({
		content: 'Twoje pliki zostały pomyślnie wysłane.',
		ephemeral: true,
	});
}

module.exports = {
	handleMessageCreate,
	handleInteraction,
};