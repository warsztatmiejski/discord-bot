const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { Client, GatewayIntentBits } = require('discord.js');

const configPath = path.resolve(__dirname, 'config.json');
const costPath = path.resolve(__dirname, 'cost-tracker.json');

// Load or initialize config and cost-tracker
let config = JSON.parse(fs.readFileSync(configPath));
let costTracker = fs.existsSync(costPath) ?
	JSON.parse(fs.readFileSync(costPath)) :
	{};

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const memory = new Map(); // channelId => [{role, content}, ...]

// Helpers
function saveConfig() {
	fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

function saveCosts() {
	fs.writeFileSync(costPath, JSON.stringify(costTracker, null, 2));
}

function getTodayKey() {
	return new Date().toISOString().split('T')[0];
}

function getRoleLimit(member) {
	for (const [roleName, limit] of Object.entries(config.perRoleDailyLimits)) {
		if (member.roles.cache.has(config.roleIds[roleName])) {
			return limit;
		}
	}
	return config.perRoleDailyLimits.default;
}

// Append memory
function appendMemory(channelId, role, content) {
	const convo = memory.get(channelId) || [];
	convo.push({ role, content });
	if (convo.length > config.memoryTurns * 2) convo.shift();
	memory.set(channelId, convo);
}

// Track cost
function trackCost(userId, costUsd, tokens) {
	const day = getTodayKey();
	if (!costTracker[day]) costTracker[day] = { total: 0, users: {} };
	costTracker[day].total += costUsd;
	costTracker[day].users[userId] = (costTracker[day].users[userId] || 0) + costUsd;
	saveCosts();
}

module.exports = {
	async handleMention(message) {
		const userId = message.author.id;
		const day = getTodayKey();
		const userRoleLimit = getRoleLimit(message.member);
		const userCost = costTracker[day]?.users[userId] || 0;
		const totalCost = costTracker[day]?.total || 0;
		if (userCost >= userRoleLimit || totalCost >= config.dailyBudgetUSD) {
			return message.reply(
				`Limit AI osiągnięty. Twój limit: ${userRoleLimit} USD, dzienny: ${config.dailyBudgetUSD} USD.`
			);
		}
		// Build messages
		const channelId = message.channelId;
		const convo = memory.get(channelId) || [];
		const userContent = message.content.replace(/<@!?\d+>/g, '').trim();
		const messages = [
			{ role: 'system', content: config.systemPrompt },
			...convo,
			{ role: 'user', content: userContent }
		];
		// Call API
		const res = await openai.chat.completions.create({
			model: 'o4-mini',
			messages,
			temperature: config.temperature,
			max_tokens: config.maxTokens
		});
		const aiText = res.choices[0].message.content;
		// Cost
		const tokens = res.usage.prompt_tokens + res.usage.completion_tokens;
		const costUsd = res.usage.prompt_tokens / 1e6 * config.pricing.input +
			res.usage.completion_tokens / 1e6 * config.pricing.output;
		trackCost(userId, costUsd, tokens);
		// Memory
		appendMemory(channelId, 'user', userContent);
		appendMemory(channelId, 'assistant', aiText);
		// Reply
		await message.reply({ content: aiText, allowedMentions: { roles: [config.roleIds.trustee] } });
	}
};