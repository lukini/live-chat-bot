import { Client, Events, GatewayIntentBits, PermissionsBitField } from 'discord.js';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';
import { EventSubHttpListener } from '@twurple/eventsub-http';
import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import appConfig from './appConfig.json' with { type: 'json' };
import configManager from './configManager.js';
import Server from './server.js';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ] 
});
const servers = [];
let apiClient, listener;

client.once(Events.ClientReady, async () => {
    const authProvider = new AppTokenAuthProvider(appConfig.twitchClientId, appConfig.twitchClientSecret);
    apiClient = new ApiClient({ authProvider });
    listener = new EventSubHttpListener({
        apiClient,
        adapter: new NgrokAdapter({
            ngrokConfig: {
                authtoken: appConfig.ngrokAuthToken
            }
        }),
        secret: appConfig.secret
    });

    const configs = configManager.getAll();
    for (const config of configs) {
        const server = new Server(config, apiClient, client, listener);
        //TODO: see if this causes issues with multiple servers
        server.addSubscriptions();
        servers.push(server);
        console.log('Server loaded with id', config.guildId);
    }

    listener.start();
});

//TODO: proxy.apply all these functions instead of multiple try-catches
client.on(Events.GuildCreate, (guild) => { handleServerAddition(guild); });
client.on(Events.GuildDelete, (guild) => { handleServerRemoval(guild); });
client.on(Events.MessageCreate, (message) => { handleNewMessage(message); });
client.on(Events.MessageUpdate, (oldMessage, newMessage) => { handleMessageUpdate(oldMessage, newMessage); });
client.on(Events.MessageDelete, (message) => { handleMessageDeletion(message); });
client.on(Events.MessageReactionAdd, (reaction, user) => { handleReactionAdd(reaction, user); });
client.on(Events.MessageReactionRemove, (reaction, user) => { handleReactionRemove(reaction, user); });

function handleServerAddition(guild) {
    const config = configManager.create(guild.id);
    const server = new Server(config, apiClient, client);
    servers.push(server);
}

function handleServerRemoval(guild) {
    const index = servers.findIndex(s => s.guildId === guild.id);
    if (index >= 0) {
        servers[index].removeSubscriptions();
        servers.splice(index, 1);
        configManager.delete(guild.id);
    }
}

function getServer(message) {
    return servers.find(s => s.guildId === message.guildId);
}

async function handleNewMessage(message) {
    const server = getServer(message);
    if (message.author.bot) return;

    let response;

    try {
        const content = message.content;
        let { command, args } = parseCommand(content);

        // mod commands
        if (command.startsWith('l?') && message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
            command = command.substring(2);
            response = server.processCommandElevated(command, args);
        } else if (message.channel.id === server.config.liveChatChannel) {
            // regular commands
            if (command.startsWith('!')) {
                command = command.substring(1);
                response = server.processCommand(message, command, args);
            } // handle tags
            else if (content.startsWith('`') && content.length > 1 && content[content.length-1] !== '`') {
                server.tagger.createTag(message, content.substring(1).trim());
            }
        }
    } catch (e) {
        console.error('Failed to run command:', e);
    }
    
    if (response instanceof Promise) {
        await response.then(res => {
            response = res;
        });
    }

    if (response) {
        console.log('Command response: ', response);
        try {
            const channel = client.channels.cache.get(message.channel.id);
            if (Array.isArray(response)) {
                for (const res of response) {
                    if (typeof res === 'string') {
                        await channel.send(res);
                    } else {
                        await channel.send({ embeds: [res] });
                    }
                }
            } else if (typeof response === 'string') {
                channel.send(response);
            } else {
                channel.send({ embeds: [response] });
            }
        } catch (e) {
            console.error('Failed to send response:', e);
        }
    }
}

function handleMessageDeletion(message) {
    const server = getServer(message);
    try {
        if (message.channel.id !== server.config.liveChatChannel) return;
        
        if (!message.content || message.content.startsWith('`')) {
            server.tagger.deleteTag(message.id);
        }
    } catch (e) {
        console.error(e);
    }
}

function handleMessageUpdate(oldMessage, newMessage) {
    const server = getServer(newMessage);
    try {
        if (oldMessage.channel.id !== server.config.liveChatChannel) return;
        if (oldMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return;

        // handle tags
        if (oldMessage.content.startsWith('`') && oldMessage.content.length > 1) {
            if (newMessage.content.startsWith('`') && newMessage.content.length > 1) {
                server.tagger.editTag(oldMessage.id, newMessage.content.substring(1).trim());
            } else {
                server.tagger.deleteTag(oldMessage.id);
            }
        }
    } catch (e) {
        console.error(e);
    }
}

function handleReactionAdd(reaction, user) {
    const server = getServer(reaction.message);
    try {
        if (reaction.message.channel.id !== server.config.liveChatChannel) return;
        if (user.bot) return;
        
        if (reaction.message.content.startsWith('`')) {
            switch (reaction.emoji.name) {
                case '⭐':
                    server.tagger.addStar(reaction.message.id);
                    break;
                case '❌':
                    server.tagger.deleteTag(reaction.message.id, user.id);
                    break;
                default:
                    break;
            }
        }
    } catch (e) {
        console.error(e);
    }
}

function handleReactionRemove(reaction, user) {
    const server = getServer(reaction.message);
    try {
        if (reaction.message.channel.id !== server.config.liveChatChannel) return;
        if (user.bot) return;
        
        if (reaction.message.content.startsWith('`')) {
            switch (reaction.emoji.name) {
                case '⭐':
                    server.tagger.removeStar(reaction.message.id);
                    break;
                default:
                    break;
            }
        }
    } catch (e) {
        console.error(e);
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

client.login(appConfig.token);