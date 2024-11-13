#!/bin/bash

# Navigate to the bot directory
cd /home/warsztatmiejski/domains/dev.warsztatmiejski.org/public_nodejs/discord/

# Source the .env file
if [ -f ".env" ]; then
	source .env
	echo "$(date): Environment variables loaded from .env."
else
	echo "$(date): .env file not found!"
	exit 1
fi

# Check if the bot is already running
if pgrep -f "node index.js" > /dev/null
then
	echo "$(date): Bot is already running."
else
	echo "$(date): Bot is not running. Starting the bot..."
	# Start the bot using the full path to node
	/usr/local/bin/node /home/warsztatmiejski/domains/dev.warsztatmiejski.org/public_nodejs/discord/index.js &
	echo "$(date): Bot started."
fi