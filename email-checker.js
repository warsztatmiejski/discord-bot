// email-checker.js - Handles email checking and Discord notifications

const { EmbedBuilder } = require('discord.js');
const { authorizeGmail, getUnreadEmails } = require('./gmail');
const fs = require('fs');
const path = require('path');

// File to track last checked emails to avoid duplicates
const LAST_CHECK_PATH = path.resolve(__dirname, 'last_email_check.json');

// Load or initialize last check data
function loadLastCheckData() {
  if (!fs.existsSync(LAST_CHECK_PATH)) {
	return { lastChecked: new Date(0), processedEmails: [] };
  }

  try {
	const data = JSON.parse(fs.readFileSync(LAST_CHECK_PATH, 'utf8'));
	return {
	  lastChecked: new Date(data.lastChecked || 0),
	  processedEmails: data.processedEmails || []
	};
  } catch (error) {
	console.error('Error loading last check data:', error);
	return { lastChecked: new Date(0), processedEmails: [] };
  }
}

// Save last check data
function saveLastCheckData(data) {
  try {
	fs.writeFileSync(LAST_CHECK_PATH, JSON.stringify(data, null, 2));
  } catch (error) {
	console.error('Error saving last check data:', error);
  }
}

// Format email date for Discord
function formatEmailDate(date) {
  const now = new Date();
  const emailDate = new Date(date);

  // Check if email is from today
  const isToday = emailDate.toDateString() === now.toDateString();

  if (isToday) {
	return `Dziś o ${emailDate.toLocaleTimeString('pl-PL', {
	  hour: '2-digit',
	  minute: '2-digit'
	})}`;
  } else {
	return emailDate.toLocaleString('pl-PL', {
	  day: '2-digit',
	  month: '2-digit',
	  year: 'numeric',
	  hour: '2-digit',
	  minute: '2-digit'
	});
  }
}

// Create Discord embed for email notification
function createEmailEmbed(email) {
  const embed = new EmbedBuilder()
	.setTitle('📧 Nowy email')
	.setColor(0x4285f4) // Gmail blue color
	.addFields(
	  { name: 'Od', value: email.from, inline: false },
	  { name: 'Temat', value: email.subject || 'Brak tematu', inline: false },
	  { name: 'Data', value: formatEmailDate(email.date), inline: true }
	)
	.setTimestamp();

  // Add snippet if available and not too long
  if (email.snippet && email.snippet.length > 0) {
	const snippet = email.snippet.length > 200
	  ? email.snippet.substring(0, 200) + '...'
	  : email.snippet;
	embed.addFields({ name: 'Podgląd', value: snippet, inline: false });
  }

  return embed;
}

// Main function to check emails and send notifications
async function checkEmailsAndNotify(client) {
  if (!process.env.FAKTURY_CHANNEL_ID) {
	console.error('FAKTURY_CHANNEL_ID not set in environment variables');
	return;
  }

  try {
	console.log('🔍 Checking for new emails...');

	// Authorize Gmail
	const authClient = await authorizeGmail();

	// Get unread emails
	const unreadEmails = await getUnreadEmails(authClient);

	if (unreadEmails.length === 0) {
	  console.log('📭 No unread emails found');
	  return;
	}

	// Load last check data
	const lastCheckData = loadLastCheckData();
	const newEmails = unreadEmails.filter(email =>
	  !lastCheckData.processedEmails.includes(email.id)
	);

	if (newEmails.length === 0) {
	  console.log('📭 No new emails since last check');
	  return;
	}

	console.log(`📬 Found ${newEmails.length} new email(s)`);

	// Get the Discord channel
	const channel = await client.channels.fetch(process.env.FAKTURY_CHANNEL_ID);
	if (!channel) {
	  console.error('Could not find faktury notification channel');
	  return;
	}

	// Send notification for each new email
	for (const email of newEmails) {
	  try {
		const embed = createEmailEmbed(email);
		await channel.send({ embeds: [embed] });
		console.log(`📧 Sent notification for email: ${email.subject}`);

		// Add small delay between messages to avoid rate limits
		await new Promise(resolve => setTimeout(resolve, 1000));
	  } catch (error) {
		console.error('Error sending email notification:', error);
	  }
	}

	// Update last check data
	const updatedData = {
	  lastChecked: new Date(),
	  processedEmails: [...lastCheckData.processedEmails, ...newEmails.map(e => e.id)]
		.slice(-100) // Keep only last 100 email IDs to prevent file from growing too large
	};
	saveLastCheckData(updatedData);

  } catch (error) {
	console.error('❌ Error checking emails:', error);
  }
}

// Setup scheduled email checking
function setupEmailChecking(client) {
  // Check immediately on startup (with delay to ensure bot is ready)
  setTimeout(() => {
	checkEmailsAndNotify(client);
  }, 30000); // 30 second delay

  // Schedule daily checks at 9 AM, 1 PM, and 5 PM
  const checkTimes = ['09:00', '13:00', '17:00'];

  setInterval(() => {
	const now = new Date();
	const currentTime = now.toTimeString().slice(0, 5); // HH:MM format

	if (checkTimes.includes(currentTime)) {
	  checkEmailsAndNotify(client);
	}
  }, 60000); // Check every minute to catch the scheduled times

  console.log('📅 Email checking scheduled for 9:00, 13:00, and 17:00 daily');
}

module.exports = {
  checkEmailsAndNotify,
  setupEmailChecking
};