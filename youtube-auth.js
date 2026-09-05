require('dotenv').config();

const { authorizeYouTube, verifyAuthorizedChannel } = require('./youtube');

async function main() {
	const authClient = await authorizeYouTube();
	const channel = await verifyAuthorizedChannel(authClient);
	console.log(`YouTube authorization ready for ${channel.snippet?.title || channel.id} (${channel.id}).`);
}

main().catch((error) => {
	console.error('YouTube authorization failed:', error);
	process.exitCode = 1;
});
