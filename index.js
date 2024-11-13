// index.js
require('dotenv').config();

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { handleMessageCreate, handleInteraction } = require('./interactions');

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
	await handleMessageCreate(client, message);
});

// Event listener for interactions (buttons, modals, select menus, slash commands)
client.on('interactionCreate', async (interaction) => {
	await handleInteraction(client, interaction);
});

// Welcome message event listener
client.on('guildMemberAdd', async (member) => {
	// Post to your welcome channel
	const channel = member.guild.channels.cache.get(1195001927717638227);

	if (channel) {
		const welcomeMessage = `<@${member.id}> właśnie dołączył/a do społeczności Warsztatu Miejskiego. Powitajmy ją/go gromkim 'hip hip hurra!'`;
		try {
			await channel.send(welcomeMessage);
		} catch (error) {
			console.error(`Could not send welcome message: ${error}`);
		}
	} else {
		console.error('Channel not found');
	}
});

client.login(process.env.BOT_TOKEN);