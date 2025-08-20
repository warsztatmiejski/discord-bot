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
  ActionRowBuilder
} = require('discord.js');
const { handleKeywordResponse } = require('./keywords');
const { handleMediaMessage, handleMediaInteraction } = require('./media');
const { handleCommand } = require('./commands');
const { handleMention } = require('./ai');
const { setupEmailChecking } = require('./email-checker');

const client = new Client({
  intents: [
	GatewayIntentBits.Guilds,
	GatewayIntentBits.GuildMembers,
	GatewayIntentBits.GuildMessages,
	GatewayIntentBits.MessageContent,
	GatewayIntentBits.GuildScheduledEvents
  ],
  partials: [Partials.Message, Partials.Channel]
});

client.once('ready', () => {
  console.log(`Logged in as ${client.user.tag}!`);
  setupEmailChecking(client);
});

client.on('messageCreate', async message => {
  try {
	console.log(`[msg] ${message.author.tag}: ${message.content}`);
	if (message.author.bot) return;

	// existing handlers
	await handleKeywordResponse(message);
	await handleMediaMessage(client, message);

	// AI mentions
	const wasMentioned = message.mentions.has(client.user);
	console.log(`→ mentions bot? ${wasMentioned}`);
	if (wasMentioned) {
	  console.log(`Invoking handleMention for ${message.author.tag}`);
	  await handleMention(message);
	}
  } catch (err) {
	console.error('❌ Error in messageCreate handler:', err);
  }
});

client.on('interactionCreate', async interaction => {
  // Slash commands
  await handleCommand(client, interaction);

  // Media uploads
  await handleMediaInteraction(client, interaction);

  // "Reply as Bot" context menu
  if (
	interaction.isMessageContextMenuCommand() &&
	interaction.commandName === 'Reply as Bot'
  ) {
	const modal = new ModalBuilder()
	  .setCustomId('botReplyModal_' + interaction.targetId)
	  .setTitle('Reply as Bot');
	const input = new TextInputBuilder()
	  .setCustomId('replyText')
	  .setLabel('What should the bot say?')
	  .setStyle(TextInputStyle.Paragraph)
	  .setRequired(true);
	modal.addComponents(new ActionRowBuilder().addComponents(input));
	await interaction.showModal(modal);
	return;
  }

  // Modal submit
  if (
	interaction.type === InteractionType.ModalSubmit &&
	interaction.customId.startsWith('botReplyModal_')
  ) {
	const targetId = interaction.customId.split('_')[1];
	const reply = interaction.fields.getTextInputValue('replyText');
	try {
	  const channel = await client.channels.fetch(interaction.channelId);
	  const msg = await channel.messages.fetch(targetId);
	  await msg.reply(reply);
	  await interaction.reply({ content: 'Bot replied!', ephemeral: true });
	} catch (err) {
	  console.error(err);
	  await interaction.reply({ content: 'Error replying.', ephemeral: true });
	}
	return;
  }
});

client.on('guildMemberAdd', async member => {
  const channel = member.guild.channels.cache.get(process.env.WELCOME_CHANNEL_ID);
  if (channel) {
	await channel.send(
	  `<@${member.id}> właśnie dołączył/a do społeczności Warsztatu Miejskiego. Powitajmy ją/go gromkim 'hip hip hurra!'`
	);
  }
});

client.login(process.env.BOT_TOKEN);