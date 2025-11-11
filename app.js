import { Client, Events, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';
import { EventSubHttpListener } from '@twurple/eventsub-http';
import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider  } from '@twurple/auth';
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
let liveChatChannel;

client.once(Events.ClientReady, async () => {
    liveChatChannel = client.channels.cache.get(config.liveChatChannel);

    const authProvider = new AppTokenAuthProvider(config.twitchClientId, config.twitchClientSecret);
    tagger.apiClient = new ApiClient({ authProvider });

    const listener = new EventSubHttpListener({
        apiClient: tagger.apiClient,
        adapter: new NgrokAdapter({
            ngrokConfig: {
                authtoken: config.ngrokAuthToken
            }
        }),
        secret: config.secret
    });
    listener.onStreamOnline(config.twitchUserId, (e) => { streamStartHandler(e); });
    listener.onStreamOffline(config.twitchUserId, (e) => { streamEndHandler(e); });
    listener.start();
});

client.on(Events.MessageCreate, (message) => { handleNewMessage(message); });
client.on(Events.MessageUpdate, (oldMessage, newMessage) => { handleMessageUpdate(oldMessage, newMessage); });
client.on(Events.MessageDelete, (message) => { handleMessageDeletion(message); });
client.on(Events.MessageReactionAdd, (reaction, user) => { handleReactionAdd(reaction, user); });
client.on(Events.MessageReactionRemove, (reaction, user) => { handleReactionRemove(reaction, user); });

async function streamStartHandler(e) {
    console.log('Stream started at ', e.startDate);
    tagger.deleteTags();
    tagger.streamStart = e.startDate;
    tagger.streamId = e.id;

    setTimeout(() => {
        tagger.checkForVod(config.twitchUserId, 0);
    }, 2 * 60 * 1000); // wait 2 minutes

    if (config.states.unlockChannel) {
        liveChatChannel.send({ embeds: [{
            color: 0x00ff99,
            title: 'Channel Unlocked',
            description: `:unlock: ${config.states.unlockMessage}`
        }] });
        liveChatChannel.permissionOverwrites.edit(config.guildId, { SendMessages: true });
    }
}

async function streamEndHandler() {
    console.log('Stream ended at ', new Date());
    tagger.streamEnd = new Date();

    if (config.states.lockChannel) {
        liveChatChannel.permissionOverwrites.edit(config.guildId, { SendMessages: null });
        liveChatChannel.send({ embeds: [{
            color: 0xff4444,
            title: 'Channel Locked',
            description: `:lock: ${config.states.lockMessage}`
        }] });
    }
    
    if (tagger.streamUrl) {
        const tags = tagger.listTags();
        const outputChannel = client.channels.cache.get(config.outputChannel);
        for (const embed of tags) {
            await outputChannel.send({ embeds: [embed] });
        }
        tagger.deleteTags();
    }
}

async function handleNewMessage(message) {
    if (message.channel.id !== config.liveChatChannel &&
        message.channel.id !== config.modCommandChannel &&
        message.channel.id !== config.outputChannel) return;
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
    else if (content.startsWith('`') && content.length > 1 && content[content.length-1] !== '`') {
        tagger.createTag(message, content.substring(1).trim());
    }
    
    if (response) {
        console.log('Command response: ', response);
        const channel = client.channels.cache.get(message.channel.id);
        if (Array.isArray(response)) {
            for (const res of response) {
                if (res instanceof EmbedBuilder) {
                    await channel.send({ embeds: [res] });
                } else {
                    await channel.send(res);
                }
            }
        } else if (response instanceof Promise) {
            response.then(res => {
                channel.send(res);
            });
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
    if (oldMessage.content.startsWith('`') && oldMessage.content.length > 1) {
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