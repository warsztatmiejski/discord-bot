// Slash commands

const fs = require('fs');
const path = require('path');
const { ApplicationCommandType, ChannelType } = require('discord.js');
const { moveMessage } = require('./move-message');
const { checkEmailsAndNotify } = require('./email-checker');

const CONFIG_PATH = path.resolve(__dirname, 'config.json');
const COST_PATH = path.resolve(__dirname, 'cost-tracker.json');

// Utility to read costs safely
function readCosts() {
	if (!fs.existsSync(COST_PATH)) return {};
	try {
		return JSON.parse(fs.readFileSync(COST_PATH, 'utf8'));
	} catch {
		return {};
	}
}

async function handleCommand(client, interaction) {
	if (!interaction.isCommand()) return;

	const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
	const cmd = interaction.commandName;
	const costs = readCosts();
	const today = new Date().toISOString().slice(0, 10);

	if (cmd === 'reakcje') {
		// Toggle keyword responses
		config.keywordsEnabled = !config.keywordsEnabled;
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
		return interaction.reply(
			`Reakcje na słowa są **${config.keywordsEnabled ? 'włączone' : 'wyłączone'}**.`
		);
	}

	if (cmd === 'ludzie') {
		const count = interaction.guild.memberCount;
		return interaction.reply(`Liczba użytkowników na serwerze: ${count}`);
	}

	if (interaction.commandName === 'koszty') {
		const entry = costs[today] || { totalUSD: 0, users: {} };
		const totalUSD = entry.totalUSD || 0;
		const userUSD = entry.users[interaction.user.id] || 0;

		return interaction.reply({
			content: `💰 Dzisiejszy koszt AI:\n` +
				`• Całkowity: **$${totalUSD.toFixed(2)}**\n` +
				`• Twoje zużycie: **$${userUSD.toFixed(2)}**`,
			ephemeral: true
		});
	}

	// Context Menu: "Move" on a message
	  if (interaction.isContextMenuCommand() &&
		  interaction.commandType === ApplicationCommandType.Message &&
		  interaction.commandName === 'Move') {
		// Ask user where to move via a quick fallback: use current channel or refuse
		// Better: you can pop a modal/select menu — keeping it simple for now.
		return interaction.reply({
		  ephemeral: true,
		  content: 'Use /move and reply to the message you want to move, choosing the target channel.'
		});
	  }

	if (interaction.isChatInputCommand() && interaction.commandName === 'move') {
		// Must be used as a reply OR specify message link in future enhancement
		const target = interaction.options.getChannel('target', true);
		const deleteOriginal = interaction.options.getBoolean('delete_original') || false;

		// Basic checks
		if (![ChannelType.GuildText, ChannelType.PublicThread, ChannelType.PrivateThread]
			 .includes(target.type)) {
		  return interaction.reply({ ephemeral: true, content: 'Pick a text channel.' });
		}

		// Retrieve the message being replied to
		const ref = interaction.channel?.messages?.resolve(interaction.targetId)
		  || interaction.options.getMessage?.('message')
		  || interaction.repliedMessage
		  || interaction.channel?.messages?.resolve(interaction.options.getString('message_id'))
		  || interaction.channel?.messages?.resolve(interaction.message?.reference?.messageId);

		if (!interaction.channel?.messages || !interaction.replied) {
		  // If discord.js convenience getters aren’t available, fetch from reference
		}
		const replied = interaction.channel?.messages?.resolve(interaction.channel?.lastMessageId);
		const message = interaction.options?.getMessage?.('message') || interaction.targetMessage || interaction.options?.get('message')?.message || interaction.options?.get('source')?.message || (interaction.options?.getString('message_url') ? null : null);

		// Simplest reliable pattern: require the user to **reply** to the message first.
		const repliedTo = interaction.options.getMessage?.('message') || interaction.channel?.messages?.resolve(interaction.reference?.messageId);
		const sourceMsg = interaction.options.getMessage?.('message') || interaction.targetMessage || interaction.options.getMessage?.('source') || interaction.channel?.messages?.resolve(interaction.options?.getString?.('message_id')) || interaction.options.getMessage?.('ref');

		// Pragmatic: fetch the message from the reply reference if present
		let msgToMove = null;
		if (interaction.options.getMessage && interaction.options.getMessage('message')) {
		  msgToMove = interaction.options.getMessage('message');
		} else if (interaction.targetMessage) {
		  msgToMove = interaction.targetMessage;
		} else if (interaction.channel?.messages && interaction.message?.reference?.messageId) {
		  msgToMove = await interaction.channel.messages.fetch(interaction.message.reference.messageId).catch(() => null);
		} else if (interaction.options.getFocused) {
		  // no-op
		}

		if (!msgToMove) {
		  return interaction.reply({
			ephemeral: true,
			content: 'Reply to the message you want to move, then run `/move target:#channel`.'
		  });
		}

		await interaction.deferReply({ ephemeral: true });
		await moveMessage(msgToMove, target.id, { deleteOriginal, footerNote: '— moved by mod' });
		return interaction.editReply('Moved.');
	  }

	if (cmd === 'faktury') {
		// Manual email check (trustee only)
		if (!interaction.member.roles.cache.has(config.roleIds.trustee)) {
			return interaction.reply({ content: 'Brak uprawnień.', ephemeral: true });
		}

		await interaction.deferReply({ ephemeral: true });
		try {
			await checkEmailsAndNotify(client);
			return interaction.followUp({ content: 'Sprawdzono emaile na faktury@warsztatmiejski.org.', ephemeral: true });
		} catch (error) {
			console.error('Error in manual email check:', error);
			return interaction.followUp({ content: 'Błąd podczas sprawdzania emaili.', ephemeral: true });
		}
	}

	if (cmd === 'kontekst') {
		// Only trustees can edit
		if (!interaction.member.roles.cache.has(config.roleIds.trustee)) {
			return interaction.reply({ content: 'Brak uprawnień.', ephemeral: true });
		}
		const newPrompt = interaction.options.getString('newprompt');
		if (newPrompt) {
			config.systemPrompt = newPrompt;
			fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
			return interaction.reply('Zaktualizowano kontekst dla AI.');
		} else {
			return interaction.reply({ content: config.systemPrompt, ephemeral: true });
		}
	}
}

module.exports = { handleCommand };