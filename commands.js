// Slash commands

const fs = require('fs');
const path = require('path');
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