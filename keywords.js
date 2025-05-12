// keywords.js

const fs = require('fs');
const CONFIG_PATH = './config.json';

const keywordResponses = [{
		keywords: ['młotek'],
		response: "_Wlazł kotek na płotek i upuścił młotek_ 😱 Pamiętaj, robienie zbyt wielu rzeczy jednocześnie zazwyczaj źle się kończy.",
	},
	{
		keywords: ['dziura', 'dziury'],
		response: "Do zalepienia dziury wystarczy trochę czekolady i kwasu siarkowego.",
	},
	{
		keywords: ['piła'],
		response: "_Piła piła, aż się upiła_ 🥴 Do pracy zawsze przychodź trzeźwy!",
	},
	{
		keywords: ['problem'],
		response: "_Problemem nie jest problem. Problemem jest twoje nastawienie do problemu._ Kapitan Jack Sparrow",
	},
	{
		keywords: ['zrobię', 'mogę zrobić'],
		response: "_Obiecanki cacanki, a głupiemu radość_ 🤡 Zastanów się – czy na pewno dasz radę to zrobić? Potem już nikt ci nie uwierzy.",
	},
	// Add more keyword responses as needed
];

const keywordCooldowns = new Map();
const COOLDOWN_TIME = 72 * 60 * 60 * 1000; // 3 days

function isKeywordsEnabled() {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH));
  return config.keywordsEnabled;
}

async function handleKeywordResponse(message) {
	if (message.author.bot) return;
	if (!isKeywordsEnabled()) return;

	// Handle keyword responses
	for (const { keywords, response } of keywordResponses) {
		// Create a regex pattern that matches any of the keywords/phrases
		const pattern = keywords
			.map((phrase) => phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
			.join('|');
		const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');

		if (regex.test(message.content)) {
			// Check cooldown for this response
			const lastResponseTime = keywordCooldowns.get(response) || 0;
			const currentTime = Date.now();

			if (currentTime - lastResponseTime < COOLDOWN_TIME) {
				// Cooldown period has not passed; do not respond
				console.log(`Cooldown active for response. Skipping.`);
				break;
			}

			try {
				// Highlight the matched keyword/phrase in the original message
				const highlightedMessage = message.content.replace(regex, '**$1**');

				// Send the response, quoting the original message
				await message.channel.send({
					content: `> ${highlightedMessage}\n${response}`,
				});

				// Update the cooldown for this response
				keywordCooldowns.set(response, currentTime);
			} catch (error) {
				console.error(`Error responding to message: ${error}`);
			}
			break; // Exit after handling one response
		}
	}
}

module.exports = {
	handleKeywordResponse,
};