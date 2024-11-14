// Slash commands

async function handleCommand(client, interaction) {
	if (!interaction.isCommand()) return;

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