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
- ` - start message with this to add a tag for the stream
- !adjust - adjust the time (in seconds) for the last tag the current user created
- !tags - list current user's tags

# Mod only commands
- l?enableopen - enable auto open with optional message
- l?disableopen - disable auto open
- l?enableclose - enable auto close with optional message
- l?disableclose - disable auto close
- l?livechat - set the channel where tagging will take place
- l?output - set the channel where the bot will output tags automatically
- l?track - start tracking a twitch user
- l?status - show current status of auto open/close
- l?tags - list all tags for the stream
- l?stream - sets the stream url (use only if the stream didn't get set)
