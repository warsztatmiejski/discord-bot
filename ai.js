// ai.js
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const {
	EmbedBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle
} = require('discord.js');

const configPath = path.resolve(__dirname, 'config.json');
const costPath = path.resolve(__dirname, 'cost-tracker.json');

let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let costTracker = fs.existsSync(costPath) ?
	JSON.parse(fs.readFileSync(costPath, 'utf8')) :
	{};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memory = new Map();

function saveCosts() {
	fs.writeFileSync(costPath, JSON.stringify(costTracker, null, 2), 'utf8');
}

function todayKey() {
	return new Date().toISOString().slice(0, 10);
}

function getRoleLimit(member) {
	const perRole = config.perRoleDailyLimits;
	for (const [roleName, usd] of Object.entries(perRole)) {
		if (roleName !== 'default' && member.roles.cache.has(config.roleIds[roleName])) {
			return usd;
		}
	}
	return perRole.default;
}

function trackCost(userId, inToks, outToks) {
	const day = todayKey();
	const entry = costTracker[day] || { totalUSD: 0, users: {} };
	const usd = (inToks / 1e6) * config.pricing.input + (outToks / 1e6) * config.pricing.output;
	entry.totalUSD = (entry.totalUSD || 0) + usd;
	entry.users[userId] = (entry.users[userId] || 0) + usd;
	costTracker[day] = entry;
	saveCosts();
	console.log(`💬 [AI] in:${inToks} out:${outToks} cost:$${usd.toFixed(6)}`);
	return usd;
}

function appendMemory(channelId, role, content) {
	const maxMsgs = config.memoryTurns * 2;
	const convo = memory.get(channelId) || [];
	convo.push({ role, content });
	if (convo.length > maxMsgs) convo.shift();
	memory.set(channelId, convo);
}

module.exports = {
	async handleMention(message) {
		if (message.mentions.everyone) return; // ignore @here and @everyone
		try {
			const userText = message.content.replace(/<@!?\d+>/g, '').trim();

			// ——— Early-exit for “wydarzenia” ———
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
						`Brak zaplanowanych wydarzeń.\n` +
						`Sprawdź pełny harmonogram na <#${config.calendarChannelId}>.`
					);
				}

				const btn = new ButtonBuilder()
					.setLabel('Przejdź do Wydarzeń')
					.setStyle(ButtonStyle.Link)
					.setURL(`https://discord.com/channels/${message.guild.id}/${config.calendarChannelId}`);

				return message.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)] });
			}

			// ——— Otherwise, regular AI flow ———
			console.log(`🔔 [AI] handleMention: ${message.author.tag}`);
			if (!process.env.OPENAI_API_KEY)
				return message.reply('AI API key not configured.');

			// budget
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

			// history
			const chanId = message.channelId;
			const convo = memory.get(chanId) || [];
			const base = [
				{ role: 'system', content: config.systemPrompt },
				...convo,
				{ role: 'user', content: userText }
			];
			console.log(`📝 [AI] prompt chars:${base.reduce((s,m)=>s+m.content.length,0)}`);

			// auto-continue
			let msgs = [...base],
				full = '',
				fin;
			do {
				const res = await openai.chat.completions.create({
					model: 'o4-mini',
					messages: msgs,
					max_completion_tokens: config.maxCompletionTokens
				});
				const c = res.choices[0];
				fin = c.finish_reason;
				const chunk = (c.message.content || '').trim();
				trackCost(userId, res.usage.prompt_tokens, res.usage.completion_tokens);
				if (fin === 'content_filter')
					return message.reply('Przepraszam, treść narusza zasady.');
				full += chunk;
				if (fin === 'length') {
					msgs.push({ role: 'assistant', content: chunk });
					msgs.push({ role: 'user', content: 'Kontynuuj.' });
				}
			} while (fin === 'length');

			if (!full)
				return message.reply('Brak odpowiedzi od AI.');

			// summarize if >2000 chars
			if (full.length > 2000) {
				console.log('✂️ Summarizing to fit 2k chars…');
				const sum = await openai.chat.completions.create({
					model: 'o4-mini',
					messages: [
						{ role: 'system', content: 'Podsumuj w max 2000 znakach, zachowując kluczowe info.' },
						{ role: 'user', content: full }
					],
					max_completion_tokens: config.maxCompletionTokens
				});
				const sc = sum.choices[0];
				full = (sc.message.content || '').trim();
				trackCost(userId, sum.usage.prompt_tokens, sum.usage.completion_tokens);
			}

			// memory & trustee
			appendMemory(chanId, 'user', userText);
			appendMemory(chanId, 'assistant', full);
			full = full.replace(/\[TRUSTEE\]/g, `<@&${config.roleIds.trustee}>`);

			// **PLAIN** reply for all non-event queries
			await message.reply({ content: full, allowedMentions: { roles: [config.roleIds.trustee] } });

			console.log(`💰 [AI] Daily spend: $${costTracker[day].totalUSD.toFixed(6)}`);
		} catch (err) {
			console.error('❌ Error in handleMention:', err);
			try { await message.reply('Błąd podczas AI.'); } catch {}
		}
	}
};