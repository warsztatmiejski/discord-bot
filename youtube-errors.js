// Never retain the Gaxios request/cause: it can contain OAuth refresh tokens.
function safeYouTubeError(error) {
	if (error?.response?.data?.error !== 'invalid_grant' && error?.message !== 'invalid_grant') {
		return error;
	}
	return Object.assign(new Error(
		'YouTube authorization expired or was revoked. Run npm run youtube:auth -- --force with the configured OAuth credentials, install the new token on the bot server, and restart the bot.'
	), { code: 'youtube_auth_required' });
}

module.exports = { safeYouTubeError };
