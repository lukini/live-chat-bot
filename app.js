const { Client, Events, GatewayIntentBits } = require('discord.js');
const { EventSubNgrokAdapter, EventSubHttpListener } = require('twitch-eventsub-ngrok');
const { ApiClient } = require('@twurple/api');
const { ClientCredentialsAuthProvider } = require('@twurple/auth');

const config = require('./config.js');
const commandHandler = require('./commandHandler.js');
const tagger = require('./tagger.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ] 
});
let modCommandChannel, apiClient;

client.once(Events.ClientReady, () => {
    modCommandChannel = client.channels.cache.get(config.commandChannel);

    //TODO: register app with twitch, get client id/secret
    const authProvider = new ClientCredentialsAuthProvider(config.clientId, config.clientSecret);
    apiClient = new ApiClient({ authProvider });
    const listener = new EventSubHttpListener({
        apiClient,
        adapter: new EventSubNgrokAdapter(),
        secret: config.secret
    });

    listener.onStreamOnline(config.twitchUserId, (e) => { streamStartHandler(e); });
    listener.onStreamOffline(config.twitchUserId, (e) => { streamEndHandler(e); });
});

client.on(Events.MessageCreate, (message) => { handleNewMessage(message); });
client.on(Events.MessageUpdate, (oldMessage, newMessage) => { handleMessageUpdate(oldMessage, newMessage); });
client.on(Events.MessageDelete, (message) => { handleMessageDeletion(message); });
client.on(Events.MessageReactionAdd, (reaction, user) => { handleReactionAdd(reaction, user); });
client.on(Events.MessageReactionRemove, (reaction, user) => { handleReactionRemove(reaction, user); });

async function streamStartHandler(e) {
    tagger.streamStart = e.startDate;

    const stream = await apiClient.streams.getStreamByUserName(userName);
    setTimeout(() => {
        checkForVod(e.broadcasterId, stream.title, 0);
    }, 5 * 60 * 1000); // wait 5 minutes

    if (config.states.unlockChannel) {
        const message = `d?liveunlock ${config.states.unlockMessage}`;
        modCommandChannel.send(message);
    }
}

async function streamEndHandler(e) {
    tagger.streamEnd = new Date();
    const tags = tagger.listTags(null);
    const outputChannel = client.channels.cache.get(config.outputChannel);
    outputChannel.send(tags);
    tagger.deleteTags();

    if (config.states.lockChannel) {
        const message = `d?livelock ${config.states.lockMessage}`;
        modCommandChannel.send(message);
    }
}

async function checkForVod(userId, streamTitle) {
    const videos = await apiClient.videos.getVideosByUser(userId, {
        type: 'archive',
        limit: 1
    });
    if (videos.data.length !== 0) {
        const latestVideo = videos.data[0];
        if (latestVideo.title === streamTitle) {
            tagger.autoStreamUrl = latestVideo.url;
        }
    } else if (retryCount < 5) {
        setTimeout(() => {
            checkForVod(userId, streamTitle, retryCount + 1);
        }, 5 * 60 * 1000); // wait 5 minutes
    }
}


function handleNewMessage(message) {
    if (message.author.bot) return;

    const content = message.content;
    const { command, args } = parseCommand(content);
    let response;

    // mod commands
    if (command.startsWith(config.commandPrefix + '?') && message.member.roles.cache.some(role => config.modRoles.includes(role.id))) {
        command = command.substring(2);
        response = commandHandler.processElevated(command, args);
    } // regular commands
    else if (command.startsWith('!')) {
        command = command.substring(1);
        response = commandHandler.process(command, message.author.id, args);
    } // handle tags
    else if (content.startsWith('`') && content.length > 1) {
        message.content = content.substring(1).trim();
        tagger.createTag(message);
    }
    
    if (response) {
        const channel = client.channels.cache.get(message.channel.id);
        channel.send(response);
    }
}

function handleMessageDeletion(message) {
    tagger.deleteTag(message.id);
}

function handleMessageUpdate(oldMessage, newMessage) {
    if (oldMessage.author.bot) return;
    if (oldMessage.content === newMessage.content) return;

    // handle tags
    if (oldMessage.content.startsWith('`')) {
        if (newMessage.content.startsWith('`') && newMessage.content.length > 1) {
            tagger.editTag(oldMessage.id, newMessage.content.substring(1).trim());
        } else {
            tagger.deleteTag(oldMessage.id);
        }
    }
}

async function handleReactionAdd(reaction, user) {
    try {
        await reaction.fetch();
    } catch (error) {
        return;
    }

    switch (reaction.emoji.name) {
        case '⭐':
            tagger.addStar(reaction.message.id);
            break;
        case '❌':
            tagger.deleteTag(reaction.message.id);
            break;
        default:
            break;
    }
}

async function handleReactionRemove(reaction, user) {
    try {
        await reaction.fetch();
    } catch (error) {
        return;
    }

    switch (reaction.emoji.name) {
        case '⭐':
            tagger.removeStar(reaction.message.id);
            break;
        default:
            break;
    }
}

function parseCommand(content) {
    const index = content.indexOf(' ');
    let command, args;
    if (index === -1) {
        command = content.substring(0, index).toLowerCase();
        args = content.substring(index + 1).trim();
    } else {
        command = content.toLowerCase();
    }
    return { command, args };
}

client.login(config.token);