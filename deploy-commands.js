require('dotenv').config();

const { REST } = require('@discordjs/rest');
const { Routes } = require('discord-api-types/v9');
const { SlashCommandBuilder } = require('@discordjs/builders');
const { ApplicationCommandType } = require('discord-api-types/v10');

const commands = [
	// Toggle keyword reactions
	new SlashCommandBuilder()
	.setName('reakcje')
	.setDescription('Włącz/wyłącz reakcje na słowa kluczowe')
	.toJSON(),

	// Count server users
	new SlashCommandBuilder()
	.setName('ludzie')
	.setDescription('Wylistuj wszystkich użytkowników serwera')
	.toJSON(),

	// Show today’s AI costs
	new SlashCommandBuilder()
	.setName('koszty')
	.setDescription('Pokaż dzisiejsze zużycie AI i koszty')
	.toJSON(),

	// Manual email check (trustee only)
	new SlashCommandBuilder()
	.setName('faktury')
	.setDescription('Sprawdź nowe emaile na faktury@warsztatmiejski.org (tylko admini)')
	.toJSON(),

	// View/Edit AI system prompt (trustee only)
	new SlashCommandBuilder()
	.setName('kontekst')
	.setDescription('Pokaż lub edytuj kontekst dla AI (tylko admini)')
	.addStringOption(opt =>
		opt
		.setName('newprompt')
		.setDescription('Nowy prompt')
	)
	.toJSON(),

	// Message Context Menu: Reply as Bot
	{
		name: 'Reply as Bot',
		type: ApplicationCommandType.Message
	}
];

const rest = new REST({ version: '9' }).setToken(process.env.BOT_TOKEN);
(async () => {
	try {
		console.log('Refreshing commands...');
		await rest.put(
			Routes.applicationGuildCommands(
				process.env.CLIENT_ID,
				process.env.GUILD_ID
			), { body: commands }
		);
		console.log('Commands deployed.');
	} catch (err) {
		console.error(err);
	}
})();