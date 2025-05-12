// Slash commands

const fs = require('fs');
const CONFIG_PATH = './config.json';

async function handleCommand(client, interaction) {
	if (!interaction.isCommand()) return;

	if (interaction.commandName === 'reakcje') {
		// Load, flip, save
		const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
		config.keywordsEnabled = !config.keywordsEnabled;
		fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
		await interaction.reply(
			`Reakcje na słowa są **${config.keywordsEnabled ? 'włączone' : 'wyłączone'}**.`
		);
		return;
	}

	if (interaction.commandName === 'ludzie') {
		const memberCount = interaction.guild.memberCount;
		await interaction.reply(
			`Liczba użytkowników na serwerze: ${memberCount}`
		);
	}

	// Add more commands as needed
}

module.exports = {
	handleCommand,
};