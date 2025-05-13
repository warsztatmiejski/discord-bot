// Slash commands

const fs = require('fs');
const CONFIG_PATH = './config.json';

async function handleCommand(client, interaction) {
  if (!interaction.isCommand()) return;

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
  const cmd = interaction.commandName;

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

  if (cmd === 'koszty') {
	const day = new Date().toISOString().slice(0,10);
	const tracker = require('./cost-tracker.json');
	const data = tracker[day] || { total: 0 };
	return interaction.reply(
	  `Dzienny koszt AI: **${data.total.toFixed(2)} USD**.`
	);
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