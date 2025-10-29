import { Client, Events, GatewayIntentBits } from 'discord.js';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { ApiClient } from '@twurple/api';
import { StaticAuthProvider } from '@twurple/auth';

import config from './config.js';
import commandHandler from './commandHandler.js';
import tagger from './tagger.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ] 
});
let modCommandChannel, apiClient;

client.once(Events.ClientReady, async () => {
    modCommandChannel = client.channels.cache.get(config.modCommandChannel);

    //TODO: register app with twitch, get client id/access token
    const authProvider = new StaticAuthProvider(config.clientId, config.accessToken);
    apiClient = new ApiClient({ authProvider });

    const listener = new EventSubWsListener({ apiClient });
    listener.onStreamOnline(config.twitchUserId, (e) => { streamStartHandler(e); });
    listener.onStreamOffline(config.twitchUserId, (e) => { streamEndHandler(e); });
});

client.on(Events.MessageCreate, (message) => { handleNewMessage(message); });
client.on(Events.MessageUpdate, (oldMessage, newMessage) => { handleMessageUpdate(oldMessage, newMessage); });
client.on(Events.MessageDelete, (message) => { handleMessageDeletion(message); });
client.on(Events.MessageReactionAdd, (reaction, user) => { handleReactionAdd(reaction, user); });
client.on(Events.MessageReactionRemove, (reaction, user) => { handleReactionRemove(reaction, user); });

async function streamStartHandler(e) {
    tagger.deleteTags();
    tagger.streamStart = e.startDate;

    setTimeout(() => {
        checkForVod(0);
    }, 5 * 60 * 1000); // wait 5 minutes

    if (config.states.unlockChannel) {
        const message = `d?liveunlock ${config.states.unlockMessage}`;
        modCommandChannel.send(message);
    }
}

async function streamEndHandler(e) {
    tagger.streamEnd = new Date();
    if (tagger.getStreamUrl()) {
        const tags = tagger.listTags();
        const outputChannel = client.channels.cache.get(config.outputChannel);
        outputChannel.send(tags);
        tagger.deleteTags();
    }

    if (config.states.lockChannel) {
        const message = `d?livelock ${config.states.lockMessage}`;
        modCommandChannel.send(message);
    }
}

//TODO: factor this out for use in the tagger for non-henya streams?
async function checkForVod(retryCount) {
    try {
        const videos = await apiClient.videos.getVideosByUser(config.twitchUserId, {
            type: 'archive',
            limit: 1
        });
        if (videos.data.length !== 0) {
            const latestVideo = videos.data[0];
            if (latestVideo.status === 'recording') {
                tagger.autoStreamUrl = latestVideo.url;
                return;
            }
        }
    } catch (e) {
        console.error('Error checking for VOD: ', e);
    }
    
    if (retryCount < 5) {
        setTimeout(() => {
            checkForVod(retryCount + 1);
        }, 5 * 60 * 1000); // wait 5 minutes
    }
}


async function handleNewMessage(message) {
    if (message.channel.id !== config.liveChatChannel && message.channel.id !== config.modCommandChannel) return;
    if (message.author.bot) return;

    const content = message.content;
    let { command, args } = parseCommand(content);
    let response;

    // mod commands
    if (command.startsWith(config.commandPrefix + '?') && message.member.roles.cache.some(role => config.modRoles.includes(role.id))) {
        command = command.substring(2);
        response = commandHandler.processElevated(command, args);
    } // regular commands
    else if (command.startsWith('!')) {
        command = command.substring(1);
        response = commandHandler.process(message, command, args);
    } // handle tags
    else if (content.startsWith('`') && content.length > 1) {
        tagger.createTag(message, content.substring(1).trim());
    }
    
    if (response) {
        const channel = client.channels.cache.get(message.channel.id);
        if (Array.isArray(response)) {
            for (const res of response) {
                await channel.send(res);
            }
        } else {
            channel.send(response);
        }
    }
}

function handleMessageDeletion(message) {
    if (message.channel.id !== config.liveChatChannel) return;
    
    if (!message.content || message.content.startsWith('`')) {
        tagger.deleteTag(message.id);
    }
}

function handleMessageUpdate(oldMessage, newMessage) {
    if (oldMessage.channel.id !== config.liveChatChannel) return;
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

function handleReactionAdd(reaction, user) {
    if (reaction.message.channel.id !== config.liveChatChannel) return;
    if (user.bot) return;
    
    if (reaction.message.content.startsWith('`')) {
        switch (reaction.emoji.name) {
            case '⭐':
                tagger.addStar(reaction.message.id);
                break;
            case '❌':
                tagger.deleteTag(reaction.message.id, user.id);
                break;
            default:
                break;
        }
    }
}

function handleReactionRemove(reaction, user) {
    if (reaction.message.channel.id !== config.liveChatChannel) return;
    if (user.bot) return;
    
    if (reaction.message.content.startsWith('`')) {
        switch (reaction.emoji.name) {
            case '⭐':
                tagger.removeStar(reaction.message.id);
                break;
            default:
                break;
        }
    }
}

function parseCommand(content) {
    const index = content.indexOf(' ');
    let command, args;
    if (index > 0) {
        command = content.substring(0, index);
        args = content.substring(index + 1).trim();
    } else {
        command = content;
    }
    return { command, args };
}

client.login(config.token);