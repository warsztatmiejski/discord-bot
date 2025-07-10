// ai.js
require('dotenv').config(); // load .env
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const OpenAI = require('openai').default;

// paths for cost and config
const configPath = path.resolve(__dirname, 'config.json');
const costPath = path.resolve(__dirname, 'cost-tracker.json');

// load config & costs
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let costTracker = fs.existsSync(costPath) ?
	JSON.parse(fs.readFileSync(costPath, 'utf8')) :
	{};

// instantiate Responses API client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// in-memory conversation memory
const memory = new Map();

// helper: save cost tracking
function saveCosts() {
	fs.writeFileSync(costPath, JSON.stringify(costTracker, null, 2), 'utf8');
}

// helper: today's key
function todayKey() {
	return new Date().toISOString().slice(0, 10);
}

// determine user role limit
function getRoleLimit(member) {
	const perRole = config.perRoleDailyLimits;
	for (const [roleName, usd] of Object.entries(perRole)) {
		if (roleName !== 'default' && member.roles.cache.has(config.roleIds[roleName])) {
			return usd;
		}
	}
	return perRole.default;
}

// track cost per user and total using usage from Responses API
function trackCost(userId, promptTokens, completionTokens, model, usage) {
	const day = todayKey();
	const entry = costTracker[day] || { totalUSD: 0, users: {} };
	const pricing = config.pricing[model] || config.pricing.default;

	let usd;
	if (promptTokens != null && completionTokens != null) {
		// Discrete prompt/completion tokens available
		usd = (promptTokens / 1e6) * pricing.input +
			(completionTokens / 1e6) * pricing.output;
	} else if (usage && usage.total_tokens != null) {
		// Fallback: charge total_tokens at input+output rate
		usd = (usage.total_tokens / 1e6) * (pricing.input + pricing.output);
	} else {
		// Last‐resort: treat nulls as zero
		usd = 0;
	}

	entry.totalUSD = (entry.totalUSD || 0) + usd;
	entry.users[userId] = (entry.users[userId] || 0) + usd;
	costTracker[day] = entry;
	saveCosts();

	console.log(
		`💬 [AI] ${model} cost:$${usd.toFixed(6)}  (` +
		`${promptTokens  ?? '-'}p, ` +
		`${completionTokens ?? '-'}c, ` +
		`${usage?.total_tokens ?? '-'} total)`
	);
	return usd;
}

// append conversation memory
function appendMemory(channelId, role, content) {
	const maxMsgs = config.memoryTurns * 2;
	const convo = memory.get(channelId) || [];
	convo.push({ role, content });
	if (convo.length > maxMsgs) convo.shift();
	memory.set(channelId, convo);
}

module.exports = {
	async handleMention(message) {
		if (message.mentions.everyone) return;
		try {
			const userText = message.content.replace(/<@!?[0-9]+>/g, '').trim();

			// quick events handler
			if (/wydarze/i.test(userText)) {
				const all = await message.guild.scheduledEvents.fetch();
				const upcoming = all
					.filter(e => e.status === 2)
					.sort((a, b) => a.scheduledStartTimestamp - b.scheduledStartTimestamp)
					.first(5);
				const embed = new EmbedBuilder().setTitle('Nadchodzące wydarzenia');
				if (upcoming.length) {
					upcoming.forEach(evt => {
						const t = `<t:${Math.floor(evt.scheduledStartTimestamp/1000)}:f>`;
						embed.addFields({ name: evt.name, value: `${t}\n<#${config.calendarChannelId}>` });
					});
				} else {
					embed.setDescription(
						`Brak zaplanowanych wydarzeń.\nSprawdź pełny harmonogram na <#${config.calendarChannelId}>.`
					);
				}
				const btn = new ButtonBuilder()
					.setLabel('Przejdź do Wydarzeń')
					.setStyle(ButtonStyle.Link)
					.setURL(`https://discord.com/channels/${message.guild.id}/${config.calendarChannelId}`);
				return message.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
			}

			console.log(`🔔 [AI] handleMention: ${message.author.tag}`);
			if (!process.env.OPENAI_API_KEY)
				return message.reply('AI API key not configured.');

			// budget and role limit check
			const day = todayKey();
			const userId = message.author.id;
			const entry = costTracker[day] || { totalUSD: 0, users: {} };
			const userUSD = entry.users[userId] || 0;
			const totUSD = entry.totalUSD || 0;
			const limUSD = getRoleLimit(message.member);
			if (totUSD >= config.dailyBudgetUSD)
				return message.reply('Dzienny budżet AI wyczerpany.');
			if (userUSD >= limUSD)
				return message.reply('Twój dzienny limit AI wyczerpany.');

			// build prompt history for memory + context
			const chanId = message.channelId;
			const convo = memory.get(chanId) || [];
			convo.length && convo; // ensure convo used to avoid lint warnings
			appendMemory(chanId, 'user', userText);

			// call Responses API with built-in web_search
			const resp = await client.responses.create({
				model: 'o4-mini',
				tools: [{ type: 'web_search' }],
				input: userText
			});
			// track cost
			if (resp.usage) {
				trackCost(
					message.author.id,
					resp.usage.prompt_tokens,
					resp.usage.completion_tokens,
					'o4-mini',
					resp.usage
				);
			}
			let full = resp.output_text || '';

			// summarize if too long
			if (full.length > 2000) {
				console.log('✂️ Summarizing to fit 2k chars…');
				const sum = await client.responses.create({
					model: 'o4-mini',
					input: `Podsumuj w max 2000 znakach, zachowując kluczowe info:\n${full}`
				});
				if (sum.usage) {
					trackCost(userId, sum.usage.prompt_tokens, sum.usage.completion_tokens, 'o4-mini');
				}
				full = sum.output_text.trim();
			}

			// update memory and reply
			appendMemory(chanId, 'assistant', full);
			full = full.replace(/\[TRUSTEE\]/g, `<@&${config.roleIds.trustee}>`);

			await message.reply({ content: full, allowedMentions: { roles: [config.roleIds.trustee] } });
			console.log(`💰 [AI] Daily spend: $${costTracker[todayKey()].totalUSD.toFixed(6)}`);

		} catch (err) {
			console.error('❌ Error in handleMention:', err);
			try { await message.reply('Błąd AI.'); } catch {}
		}
	}
};