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

# Mod only commands (using default prefix)
- l?enableopen - enable auto open with optional message
- l?disableopen - disable auto open
- l?enableclose - enable auto close with optional message
- l?disableclose - disable auto close
- l?status - show current status of auto open/close
- l?tags - list all tags for the stream
- l?setstream - sets the stream url (use only if the stream didn't get set)
