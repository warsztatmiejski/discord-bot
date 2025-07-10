// ai.js
require('dotenv').config();               // load .env
const fs    = require('fs');
const path  = require('path');
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const OpenAI = require('openai').default;

// — Paths & Config —
const configPath  = path.resolve(__dirname, 'config.json');
const costPath    = path.resolve(__dirname, 'cost-tracker.json');
let config        = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let costTracker   = fs.existsSync(costPath)
  ? JSON.parse(fs.readFileSync(costPath, 'utf8'))
  : {};

// — OpenAI Clients & Memory —
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });  // Responses API
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });  // Chat Completions for fallback
const memory = new Map();
let lastRespId = null;

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
function trackCost(userId, pToks, cToks, model, usage) {
  const day   = todayKey();
  const entry = costTracker[day] || { totalUSD: 0, users: {} };
  const pricing = config.pricing[model] || config.pricing.default;
  let usd;
  if (pToks != null && cToks != null) {
	usd = (pToks/1e6)*pricing.input + (cToks/1e6)*pricing.output;
  } else if (usage?.total_tokens != null) {
	usd = (usage.total_tokens/1e6)*(pricing.input+pricing.output);
  } else {
	usd = 0;
  }
  entry.totalUSD        = (entry.totalUSD||0) + usd;
  entry.users[userId]   = (entry.users[userId]||0) + usd;
  costTracker[day]      = entry;
  saveCosts();
  console.log(`💬 [AI] ${model} cost:$${usd.toFixed(6)} (${pToks??'-'}p, ${cToks??'-'}c, ${usage?.total_tokens??'-'} total)`);
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
		const upcoming = all.filter(e=>e.status===2)
							.sort((a,b)=>a.scheduledStartTimestamp-b.scheduledStartTimestamp)
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
		return message.reply({ embeds:[embed], components:[new ActionRowBuilder().addComponents(btn)] });
	  }

	  // — Budget & Role Limits —
	  if (!process.env.OPENAI_API_KEY)
		return message.reply('AI API key not configured.');
	  const day     = todayKey();
	  const uid     = message.author.id;
	  const entry   = costTracker[day] || { totalUSD:0, users:{} };
	  const userUSD = entry.users[uid]  || 0;
	  const totUSD  = entry.totalUSD     || 0;
	  const limUSD  = getRoleLimit(message.member);
	  if (totUSD >= config.dailyBudgetUSD)
		return message.reply('Dzienny budżet AI wyczerpany.');
	  if (userUSD >= limUSD)
		return message.reply('Twój dzienny limit AI wyczerpany.');

	  // — Memory Context —
	  const chanId = message.channelId;
	  appendMemory(chanId, 'user', userText);

	  // — Responses API Call with web_search —
	  const resp = await client.responses.create({
		model: 'o4-mini',
		instructions: config.systemPrompt,
		tools: [{ type: 'web_search' }],
		input: userText,
		previous_response_id: lastRespId
	  });
	  lastRespId = resp.id;

	  trackCost(uid, resp.usage.prompt_tokens, resp.usage.completion_tokens, 'o4-mini', resp.usage);
	  let full = resp.output_text || '';

	  // — Streaming Fallback (if needed) —
	  if (!full.trim()) {
		let msgs = [
		  { role:'system', content: config.systemPrompt },
		  ... (memory.get(chanId)||[]),
		  { role:'user', content: userText }
		], fin, chunk;
		full = '';
		do {
		  const res = await openai.chat.completions.create({
			model: 'o4-mini',
			messages: msgs,
			max_completion_tokens: config.maxCompletionTokens
		  });
		  const c = res.choices[0];
		  fin = c.finish_reason;
		  chunk = (c.message.content||'').trim();
		  full += chunk;
		  trackCost(uid, res.usage.prompt_tokens, res.usage.completion_tokens, 'o4-mini');
		  if (fin==='content_filter')
			return message.reply('Przepraszam, treść narusza zasady.');
		  if (fin==='length') {
			msgs.push({ role:'assistant', content:chunk });
			msgs.push({ role:'user',      content:'Kontynuuj.' });
		  }
		} while(fin==='length');
	  }

	  // — No Answer Guard —
	  if (!full) return message.reply('Brak odpowiedzi od AI.');

	  // — Summarize if too long —
	  if (full.length > 2000) {
		const sum = await openai.chat.completions.create({
		  model: 'o4-mini',
		  messages: [
			{ role:'system', content:'Podsumuj w max 2000 znakach, zachowując kluczowe info.' },
			{ role:'user',   content: full }
		  ],
		  max_completion_tokens: config.maxCompletionTokens
		});
		trackCost(uid, sum.usage.prompt_tokens, sum.usage.completion_tokens, 'o4-mini');
		full = (sum.choices[0].message.content||'').trim();
	  }

	  // — Reply & Memory —
	  appendMemory(chanId, 'assistant', full);
	  full = full.replace(/\[TRUSTEE\]/g, `<@&${config.roleIds.trustee}>`);
	  await message.reply({ content: full, allowedMentions:{ roles:[config.roleIds.trustee] } });
	  console.log(`💰 [AI] Daily spend: $${costTracker[todayKey()].totalUSD.toFixed(6)}`);

	} catch (err) {
	  console.error('❌ Error in handleMention:', err);
	  try { await message.reply('Błąd AI.'); } catch {}
	}
  }
};