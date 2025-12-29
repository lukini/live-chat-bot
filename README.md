# Features
- Tracks stream start/end for a twitch user
- Opens/closes #live-chat if turned on
- Keeps track of current stream url and when it starts/ends
- Keeps track of tags including reactions, edits, and deletions
- Prints out tags after stream
- Stores past stream tags

# Commands
- !t / !tag / ` - Start a message with this to add a tag for the stream
- !adjust - Adjust the time (in seconds) for the last tag the current user created
- !tags - List current user's tags

# Mod only commands
- l?enableopen - Enable auto open with optional message
- l?disableopen - Disable auto open
- l?enableclose - Enable auto close with optional message
- l?disableclose - Disable auto close
- l?openmessage - Sets the auto open message
- l?closemessage - Sets the auto close message
- l?livechat - Set the channel where tagging will take place. Takes a #channel or id. Removes channel if one isn't given.
- l?output - Set the channel where tags will be output. Takes a #channel or id. Removes channel if one isn't given.
- l?track - Start tracking a twitch user. Takes a username or id. Removes tracking if one isn't given.
- l?status - Show current status of the bot's config
- l?checkurl - Check the current stream url
- l?tags - List all tags for the stream. Provide a VOD url to see previous tags if they exist.
- l?cleartags - Clear the current tags
- l?startstream - Manually start stream. Only works when chat isn't open. Sets the VOD url given to it.
- l?endstream - Manually end stream. Closes chat and prints tags. Use with l?startstream.
- l?setstream - Set the VOD url. Only use if the VOD didn't get found or set for some reason.
- l?test - Tests if the bot has the permissions needed for the current channel. Output indicates if it worked. No output means it can't send messages.

# Prerequisites
[Node.js](https://nodejs.org/en/download) and [ngrok](https://ngrok.com/download) are currently required to run locally. Get your ngrok auth token [here](https://dashboard.ngrok.com/get-started/your-authtoken) and your register the app with twitch [following these steps](https://dev.twitch.tv/docs/authentication/register-app) to get your client id/secret.

# Install
git clone the repository and run this from the folder:
```
npm install
```

Update the appConfig.json file with all your values from above along with your discord bot's token.  Alternately, you can pass in your own file location with `--config`:
```
node app.js --config path/to/config.json
```
