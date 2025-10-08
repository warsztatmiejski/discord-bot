// move-message.js
const { PermissionFlagsBits, WebhookClient } = require('discord.js');
const fetch = require('node-fetch'); // v2 in your package.json

/**
 * Repost a message to another channel via webhook (optionally delete original).
 * - Mimics author's name + avatar using webhook overrides.
 * - Re-uploads attachments.
 * - Keeps embeds (components won’t keep behavior).
 */
async function moveMessage(message, targetChannelId, opts = {}) {
  const { deleteOriginal = false, footerNote = '' } = opts;

  if (!message?.guild) throw new Error('This works only in guild channels.');
  const guild = message.guild;

  const targetChannel = await guild.channels.fetch(targetChannelId);
  if (!targetChannel) throw new Error('Target channel not found.');

  // Create or reuse a webhook owned by this bot in the target channel
  const hooks = await targetChannel.fetchWebhooks();
  let hook = hooks.find(h => h.owner?.id === message.client.user.id);
  if (!hook) {
	hook = await targetChannel.createWebhook({
	  name: 'Message Mover',
	  reason: `Reposting from #${message.channel?.name || message.channelId}`,
	});
  }
  const webhook = new WebhookClient({ url: hook.url });

  // Prepare author look & feel
  const username = message.member?.displayName || message.author?.username || 'Member';
  const avatarURL = message.author?.displayAvatarURL?.({ size: 128 });

  // Download & stage attachments so we can re-upload them
  const files = [];
  for (const [, att] of message.attachments) {
	const res = await fetch(att.url);
	const buf = await res.buffer();
	files.push({ attachment: buf, name: att.name });
  }

  // Backlink to source for audit trail
  const jumpLink = message.url; // discord.js exposes a canonical message URL
  const suffix = footerNote ? `\n${footerNote}` : '';
  const content = `${message.content || ''}\n\n[↩︎ Source](${jumpLink})${suffix}`;

  await webhook.send({
	username,
	avatarURL, // webhook override (documented by Discord)
	content: content.trim(),
	embeds: message.embeds?.length ? message.embeds : undefined,
	files: files.length ? files : undefined,
	allowedMentions: { parse: [] }, // avoid accidental re-pings
  });

  if (deleteOriginal && message.channel
	.permissionsFor(message.client.user)?.has(PermissionFlagsBits.ManageMessages)) {
	await message.delete().catch(() => {});
  }
}

module.exports = { moveMessage };