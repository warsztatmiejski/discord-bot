require('dotenv').config();

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ApplicationCommandType } = require('discord-api-types/v10');

const slashCommands = [
	new SlashCommandBuilder()
	.setName('ludzie')
	.setDescription('List the number of all server users')
	.toJSON(),
];

const messageContextCommands = [{
	name: 'Reply as Bot',
	type: ApplicationCommandType.Message, // IMPORTANT for a Message Context Menu
}, ];

const commands = [...slashCommands, ...messageContextCommands];

const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

(async () => {
	try {
		console.log('Started refreshing application (/) commands.');

		await rest.put(
			Routes.applicationGuildCommands(
				process.env.CLIENT_ID,
				process.env.GUILD_ID
			), { body: commands }
		);

		console.log('Successfully reloaded application (/) commands.');
	} catch (error) {
		console.error(error);
	}
})();