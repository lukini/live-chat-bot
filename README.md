Features:
- Opens/closes #live-chat if turned on
- Keeps track of current stream url and when it starts/ends
- Keeps track of tags including reactions, edits, and deletions
- Prints out tags after stream

Commands:
- !t (or start message with `) - add a tag for the stream
- !adjust - adjust the time (in seconds) for the last tag the current user created
- !tags - list current user's tags

Mod only commands (using default prefix):
- l?enableopen - enable auto open with optional message
- l?disableopen - disable auto open
- l?enableclose - enable auto close with optional message
- l?disableclose - disable auto close
- l?status - show current status of auto open/close
- l?tags - list all tags for the stream
- l?setstream - sets the stream url (use only if the stream didn't get set)
- l?checkurl - check current stream url grabbed by the bot
