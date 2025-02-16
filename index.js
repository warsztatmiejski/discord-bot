// Discord Bot

require('dotenv').config();

const {
	Client,
	GatewayIntentBits,
	Partials,
	InteractionType,
	ModalBuilder,
	TextInputBuilder,
	TextInputStyle,
	ActionRowBuilder,
	ApplicationCommandType,
} = require('discord.js');
const { handleMediaMessage, handleMediaInteraction } = require('./media');
const { handleKeywordResponse } = require('./keywords');
const { handleCommand } = require('./commands');

// Initialize the Discord client
const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages, // Needed for message events
		GatewayIntentBits.MessageContent, // Needed to read message content
	],
	partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

client.once('ready', () => {
	console.log(`Logged in as ${client.user.tag}!`);
});

// Event listener for messages
client.on('messageCreate', async (message) => {
	// Handle keyword responses
	await handleKeywordResponse(message);

	// Handle media uploads
	await handleMediaMessage(client, message);
});

// Event listener for interactions (buttons, modals, select menus, slash commands)
client.on('interactionCreate', async (interaction) => {
	// Handle slash commands
	await handleCommand(client, interaction);

	// Context menu
	if (
		interaction.isMessageContextMenuCommand() &&
		interaction.commandName === 'Reply as Bot'
	) {
		// The user triggered "Apps → Reply as Bot" on a message
		const modal = new ModalBuilder()
			.setCustomId('botReplyModal_' + interaction.targetId)
			.setTitle('Reply as Bot');

		const replyInput = new TextInputBuilder()
			.setCustomId('replyText')
			.setLabel('Co na to Św. McGyver?')
			.setStyle(TextInputStyle.Paragraph)
			.setRequired(true);

		const row = new ActionRowBuilder().addComponents(replyInput);
		modal.addComponents(row);

		await interaction.showModal(modal);
		return;
	}

	// Modal submission
	if (
		interaction.type === InteractionType.ModalSubmit &&
		interaction.customId.startsWith('botReplyModal_')
	) {
		// Extract message ID from the customId
		const targetMessageId = interaction.customId.split('_')[1];
		const replyText = interaction.fields.getTextInputValue('replyText');

		try {
			// Fetch the channel and message
			const channel = await client.channels.fetch(interaction.channelId);
			const targetMessage = await channel.messages.fetch(targetMessageId);

			await targetMessage.reply(replyText);

			// Confirm success to user
			await interaction.reply({
				content: 'Bot replied successfully!',
				ephemeral: true,
			});
		} catch (error) {
			console.error('Error replying as bot:', error);
			await interaction.reply({
				content: 'Something went wrong replying as the bot.',
				ephemeral: true,
			});
		}
		return;
	}

	// Handle interactions related to media uploads
	await handleMediaInteraction(client, interaction);
});

// Welcome message event listener
client.on('guildMemberAdd', async (member) => {
	// Post to your welcome channel
	const channel = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);

	if (channel) {
		const welcomeMessage = `<@${member.id}> właśnie dołączył/a do społeczności Warsztatu Miejskiego. Powitajmy ją/go gromkim 'hip hip hurra!'`;
		try {
			await channel.send(welcomeMessage);
		} catch (error) {
			console.error(`Could not send welcome message: ${error}`);
		}
	} else {
		console.error('Welcome channel not found');
	}
});

client.login(process.env.BOT_TOKEN);