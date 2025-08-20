// ai.js
require('dotenv').config(); // load .env
const fs = require('fs');
const path = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const OpenAI = require('openai').default;
const { getRelevantContext } = require('./warsztat-miejski');

// — Paths & Config —
const configPath = path.resolve(__dirname, 'config.json');
const costPath = path.resolve(__dirname, 'cost-tracker.json');
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let costTracker = fs.existsSync(costPath) ?
	JSON.parse(fs.readFileSync(costPath, 'utf8')) :
	{};

// — OpenAI Client & Memory —
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memory = new Map();
let lastRespId = null;
const MODEL = config.model || 'o4-mini'; // Fixed: provide fallback

// — Helpers —
function saveCosts() {
	fs.writeFileSync(costPath, JSON.stringify(costTracker, null, 2), 'utf8');
}

function todayKey() {
	return new Date().toISOString().slice(0, 10);
}

function getRoleLimit(member) {
	const perRole = config.perRoleDailyLimits;
	for (const [r, usd] of Object.entries(perRole)) {
		if (r !== 'default' && member.roles.cache.has(config.roleIds[r])) {
			return usd;
		}
	}
	return perRole.default;
}

function trackCost(userId, usage, model) {
	const day = todayKey();
	const entry = costTracker[day] || { totalUSD: 0, users: {} };
	const pricing = config.pricing[model] || config.pricing['o4-mini']; // Fixed: fallback pricing

	// Handle Responses API usage format
	const pToks = usage.prompt_tokens || usage.input_tokens || 0;
	const cToks = usage.completion_tokens || usage.output_tokens || 0;

	const usd = (pToks / 1e6) * pricing.input + (cToks / 1e6) * pricing.output;

	entry.totalUSD = (entry.totalUSD || 0) + usd;
	entry.users[userId] = (entry.users[userId] || 0) + usd;
	costTracker[day] = entry;
	saveCosts();
	console.log(`💬 [AI] ${model} cost:${usd.toFixed(6)} (${pToks}p, ${cToks}c)`);
}

function appendMemory(chanId, role, content) {
	const max = config.memoryTurns * 2;
	const convo = memory.get(chanId) || [];
	convo.push({ role, content });
	if (convo.length > max) convo.shift();
	memory.set(chanId, convo);
}

// — Main Handler —
module.exports = {
	async handleMention(message) {
		if (message.mentions.everyone) return;
		try {
			const userText = message.content.replace(/<@!?[0-9]+>/g, '').trim();

			// — Event Shortcut —
			if (/wydarze/i.test(userText)) {
				const all = await message.guild.scheduledEvents.fetch();
				const upcoming = all.filter(e => e.status === 2)
					.sort((a, b) => a.scheduledStartTimestamp - b.scheduledStartTimestamp)
					.first(5);
				const embed = new EmbedBuilder().setTitle('Nadchodzące wydarzenia');
				if (upcoming.length) {
					upcoming.forEach(evt => {
						const t = `<t:${Math.floor(evt.scheduledStartTimestamp/1000)}:f>`;
						embed.addFields({ name: evt.name, value: `${t}\n<#${config.calendarChannelId}>` });
					});
				} else {
					embed.setDescription(`Brak zaplanowanych wydarzeń.\nSprawdź pełny harmonogram na <#${config.calendarChannelId}>.`);
				}
				const btn = new ButtonBuilder()
					.setLabel('Przejdź do Wydarzeń')
					.setStyle(ButtonStyle.Link)
					.setURL(`https://discord.com/channels/${message.guild.id}/${config.calendarChannelId}`);
				return message.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
			}

			// — Budget & Role Limits —
			if (!process.env.OPENAI_API_KEY)
				return message.reply('AI API key not configured.');
			const day = todayKey();
			const uid = message.author.id;
			const entry = costTracker[day] || { totalUSD: 0, users: {} };
			const userUSD = entry.users[uid] || 0;
			const totUSD = entry.totalUSD || 0;
			const limUSD = getRoleLimit(message.member);
			if (totUSD >= config.dailyBudgetUSD)
				return message.reply('Dzienny budżet AI wyczerpany.');
			if (userUSD >= limUSD)
				return message.reply('Twój dzienny limit AI wyczerpany. Spróbuj ponownie jutro.');

			// — Memory Context —
			const chanId = message.channelId;

			// Grab the first attachment URL (if any)
			const attachment = message.attachments.first();

			// Build conversation history from memory
			const conversation = memory.get(chanId) || [];

			// Convert stored conversation to Responses API format
			const multimodalInput = [];

			// Add conversation history
			for (const msg of conversation) {
				if (msg.role === 'user') {
					multimodalInput.push({
						role: 'user',
						content: [{ type: 'input_text', text: msg.content }]
					});
				} else if (msg.role === 'assistant') {
					multimodalInput.push({
						role: 'assistant',
						content: [{ type: 'output_text', text: msg.content }]
					});
				}
			}

			// Add current user message (with attachment if present)
			multimodalInput.push({
				role: 'user',
				content: [
					{ type: 'input_text', text: userText + getRelevantContext(userText) },
					// if there's an image, tack on an image block:
					...(attachment ?
						[{ type: 'input_image', image_url: attachment.url }] :
						[])
				]
			});

			// Store current user message in memory
			appendMemory(chanId, 'user', userText);

			// — Responses API Call with web_search —
			const resp = await openai.responses.create({
				model: MODEL,
				instructions: config.systemPrompt,
				tools: [
					{
						type: 'web_search'
					},
					{
						type: 'code_interpreter',
						container: {
							type: 'auto'
						}
					}
				],
				input: multimodalInput,
				previous_response_id: lastRespId
			});
			lastRespId = resp.id;

			trackCost(uid, resp.usage, MODEL);

			let full = resp.output_text || '';

			// — No Answer Guard —
			if (!full) return message.reply('Brak odpowiedzi od AI.');

			// — Handle long responses using Responses API for summarization —
			if (full.length > 2000) {
				console.log('✂️ Summarizing to fit 2k chars using Responses API…');
				const sumResp = await openai.responses.create({
					model: MODEL,
					instructions: 'Podsumuj w max 2000 znakach, zachowując kluczowe informacje.',
					input: [{ role: 'user', content: [{ type: 'input_text', text: full }] }]
				});

				trackCost(uid, sumResp.usage, MODEL);
				full = (sumResp.output_text || '').trim();
			}

			// — Reply & Memory —
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