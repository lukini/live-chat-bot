# Features
- Opens/closes #live-chat if turned on
- Keeps track of current stream url and when it starts/ends
- Keeps track of tags including reactions, edits, and deletions
- Prints out tags after stream

# Prerequisites
[Node.js](https://nodejs.org/en/download) and [ngrok](https://ngrok.com/download) are currently required to run locally. Get your ngrok auth token [here](https://dashboard.ngrok.com/get-started/your-authtoken) and your register the app with twitch [following these steps](https://dev.twitch.tv/docs/authentication/register-app) to get your client id/secret.

# Install
git clone the repository and run this from the folder
```
npm install
```

# Commands
- ` - Start a message with this to add a tag for the stream
- !adjust - Adjust the time (in seconds) for the last tag the current user created
- !tags - List current user's tags

# Mod only commands
- l?enableopen - Enable auto open with optional message
- l?disableopen - Disable auto open
- l?enableclose - Enable auto close with optional message
- l?disableclose - Disable auto close
- l?livechat - Set the channel where tagging will take place. Takes a @channel or id.
- l?output - Set the channel where tags will be output. Takes a @channel or id.
- l?track - Start tracking a twitch user. Takes a username or id.
- l?status - Show current status of the bot's config
- l?checkurl - Check the current stream url
- l?tags - List all tags for the stream
- l?deletetags - Delete the current tags
- l?stream - Set the stream url (use only if the stream didn't get set)
