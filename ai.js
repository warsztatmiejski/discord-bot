// ai.js
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const configPath = path.resolve(__dirname, 'config.json');
const costPath   = path.resolve(__dirname, 'cost-tracker.json');

// Load config & initialize cost tracker
let config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
let costTracker = fs.existsSync(costPath)
  ? JSON.parse(fs.readFileSync(costPath, 'utf8'))
  : {};

// Initialize OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// In-memory conversation memory: channelId → [{role,content}, …]
const memory = new Map();

// Helpers

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

function trackCost(userId, promptTokens, completionTokens) {
  const day = todayKey();
  const entry = costTracker[day] || { totalUSD: 0, users: {} };

  const usdCost =
	(promptTokens    / 1e6) * config.pricing.input  +
	(completionTokens / 1e6) * config.pricing.output;

  entry.totalUSD          = (entry.totalUSD  || 0) + usdCost;
  entry.users[userId]     = (entry.users[userId] || 0) + usdCost;
  costTracker[day]        = entry;
  saveCosts();

  // Log per-call usage
  console.log(
	`💬 [AI] Tokens in: ${promptTokens}, out: ${completionTokens}, cost: $${usdCost.toFixed(6)}`
  );

  return usdCost;
}

function appendMemory(channelId, role, content) {
  const maxMsgs = config.memoryTurns * 2;
  const convo   = memory.get(channelId) || [];
  convo.push({ role, content });
  if (convo.length > maxMsgs) convo.shift();
  memory.set(channelId, convo);
}

// Main handler
module.exports = {
  async handleMention(message) {
	try {
	  console.log(`🔔 [AI] handleMention: ${message.author.tag}`);

	  if (!process.env.OPENAI_API_KEY) {
		console.error('❌ Missing OPENAI_API_KEY');
		return message.reply('AI API key not configured.');
	  }

	  // Budget checks
	  const day       = todayKey();
	  const userId    = message.author.id;
	  const entry     = costTracker[day] || { totalUSD: 0, users: {} };
	  const userUSD   = entry.users[userId] || 0;
	  const totalUSD  = entry.totalUSD || 0;
	  const userLimit = getRoleLimit(message.member);

	  if (totalUSD >= config.dailyBudgetUSD) {
		return message.reply('Dzienny budżet AI został wyczerpany. Spróbuj jutro.');
	  }
	  if (userUSD >= userLimit) {
		return message.reply('Wyczerpałeś swój dzienny limit AI.');
	  }

	  // Build history
	  const channelId = message.channelId;
	  const convo     = memory.get(channelId) || [];
	  const userText  = message.content.replace(/<@!?\d+>/g, '').trim();

	  const baseMessages = [
		{ role: 'system', content: config.systemPrompt },
		...convo,
		{ role: 'user',   content: userText }
	  ];

	  console.log(
		`📝 [AI] prompt chars: ${
		  baseMessages.reduce((sum, m) => sum + m.content.length, 0)
		}`
	  );

	  // Auto-continue loop
	  let messages     = [...baseMessages];
	  let fullReply    = '';
	  let finishReason = null;

	  do {
		const res = await openai.chat.completions.create({
		  model:                 'o4-mini',
		  messages,
		  max_completion_tokens: config.maxCompletionTokens
		});

		const choice = res.choices[0];
		finishReason = choice.finish_reason; // 'stop' | 'length' | 'content_filter'
		const chunk   = (choice.message.content || '').trim();

		// Track this chunk's cost
		trackCost(
		  userId,
		  res.usage.prompt_tokens,
		  res.usage.completion_tokens
		);

		if (finishReason === 'content_filter') {
		  return message.reply(
			'Przepraszam, Twoja prośba narusza zasady bezpieczeństwa.'
		  );
		}

		fullReply += chunk;

		if (finishReason === 'length') {
		  // prepare for continuation
		  messages.push({ role: 'assistant', content: chunk });
		  messages.push({ role: 'user',      content: 'Kontynuuj.' });
		}
	  } while (finishReason === 'length');

	  if (!fullReply) {
		return message.reply(
		  'Przepraszam, nie otrzymałem odpowiedzi od AI. Spróbuj ponownie.'
		);
	  }

	  // Save memory
	  appendMemory(channelId, 'user',      userText);
	  appendMemory(channelId, 'assistant', fullReply);

	  // Replace trustee placeholder
	  fullReply = fullReply.replace(
		/\[TRUSTEE\]/g,
		`<@&${config.roleIds.trustee}>`
	  );

	  // Reply
	  await message.reply({
		content: fullReply,
		allowedMentions: { roles: [config.roleIds.trustee] }
	  });

	  // Log daily spend
	  console.log(
		`💰 [AI] Daily spend: $${costTracker[day].totalUSD.toFixed(6)}`
	  );
	}
	catch (err) {
	  console.error('❌ Error in handleMention:', err);
	  try {
		await message.reply('Wystąpił błąd podczas generowania odpowiedzi AI.');
	  } catch {}
	}
  }
};