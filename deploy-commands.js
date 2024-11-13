require('dotenv').config();
const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');

const commands = [
  new SlashCommandBuilder()
	.setName('ludzie')
	.setDescription('List the number of all server users')
	.toJSON(),
];

const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);

(async () => {
  try {
	console.log('Started refreshing application (/) commands.');

	await rest.put(
	  Routes.applicationGuildCommands('1199789423957655632', '1195001927243665538'),
	  { body: commands }
	);

	console.log('Successfully reloaded application (/) commands.');
  } catch (error) {
	console.error(error);
  }
})();