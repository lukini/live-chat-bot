import { AttachmentBuilder, PermissionsBitField } from 'discord.js';
import db from './db.js';
import Server from './server.js';

class EventHandler {
    servers = null;
    twitchApi = null;
    client = null;
    listener = null;

    constructor(servers, twitchApi, client, listener) {
        this.servers = servers;
        this.twitchApi = twitchApi;
        this.client = client;
        this.listener = listener;
    }
    
    handleServerAddition(guild) {
        this.createServer(guild.id);
    }

    handleServerRemoval(guild) {
        const index = this.servers.findIndex(s => s.guildId === guild.id);
        if (index >= 0) {
            this.servers[index].removeSubscriptions();
            this.servers.splice(index, 1);
            db.deleteServer(guild.id);
        }
    }

    getServer(message) {
        let server = this.servers.find(s => s.guildId === message.guildId);
        if (!server) {
            server = this.createServer(message.guildId);
        }
        return server;
    }

    getServerById(guildId) {
        return this.servers.find(s => s.guildId === guildId);
    }

    createServer(guildId) {
        const config = db.createServer(guildId);
        const server = new Server(config, this.twitchApi, this.client, this.listener);
        this.servers.push(server);
        return server;
    }

    handleProcessEnd() {
        process.exit(0);
    }

    async handleNewMessage(message) {
        if (message.author.bot) return;

        let response;

        try {
            const content = message.content;
            let { command, args } = this.parseCommand(content);

            // handle DMs
            if (message.channel.type === 1) {
                args = this.parseArgs(args);
                const server = this.getServerById(args[0]);
                if (server) {
                    response = server.processDMCommand(command.substring(1), args.slice(1));
                }
            } else {
                const server = this.getServer(message);

                // mod commands
                if (command.startsWith('l?') && message.member.permissions.has(PermissionsBitField.Flags.ManageMessages)) {
                    command = command.substring(2);
                    response = server.processCommandElevated(message, command, args);
                } else if (message.channel.id === server.config.liveChatChannel) {
                    // regular commands
                    if (command.startsWith('!')) {
                        command = command.substring(1);
                        response = server.processCommand(message, command, args);
                    } // handle tags
                    else if (content.startsWith('`') && content[content.length-1] !== '`') {
                        server.tagger.createTag(message, content.substring(1).trim());
                    }
                }
            }
        } catch (e) {
            console.error(`[${message.guildId}] Failed to run command:`, e);
        }
        
        if (response instanceof Promise) {
            await response.then(res => {
                response = res;
            });
        }

        if (response) {
            console.log(`[${message.guildId}] Command response:`, response);
            try {
                const channel = this.client.channels.cache.get(message.channel.id);
                if (Array.isArray(response)) {
                    for (const res of response) {
                        await this.sendResponse(channel, res);
                    }
                } else {
                    await this.sendResponse(channel, response);
                }
            } catch (e) {
                console.error(`[${message.guildId}] Failed to send response:`, e);
            }
        }
    }

    async sendResponse(channel, response) {
        if (typeof response === 'string') {
            await channel.send(response);
        } else if (response instanceof AttachmentBuilder) {
            await channel.send({ files: [response] });
        } else {
            await channel.send({ embeds: [response] });
        }
    }

    handleMessageDeletion(message) {
        // handle DMs
        if (message.channel.type === 1) {
            return;
        }

        const server = this.getServer(message);
        if (message.channel.id !== server.config.liveChatChannel) return;
        
        // handle tags
        server.tagger.deleteTag(message.id);
    }

    handleMessageUpdate(oldMessage, newMessage) {
        if (oldMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return;
        const server = this.getServer(newMessage);
        if (oldMessage.channel.id !== server.config.liveChatChannel) return;

        // handle tags
        const content = this.getTagContent(newMessage.content);
        server.tagger.editTag(oldMessage.id, content || '');
    }

    handleReactionAdd(reaction, user) {
        if (user.bot) return;
        const server = this.getServer(reaction.message);
        if (reaction.message.channel.id !== server.config.liveChatChannel) return;
        
        switch (reaction.emoji.name) {
            case '👍':
                server.tagger.addStar(reaction.message.id);
                break;
            case '❌':
                server.tagger.deleteTag(reaction.message.id, user.id);
                break;
            default:
                break;
        }
    }

    handleReactionRemove(reaction, user) {
        if (user.bot) return;
        const server = this.getServer(reaction.message);
        if (reaction.message.channel.id !== server.config.liveChatChannel) return;
        
        switch (reaction.emoji.name) {
            case '👍':
                server.tagger.removeStar(reaction.message.id);
                break;
            case '❌':
                server.tagger.undeleteTag(reaction.message.id, user.id);
                break;
            default:
                break;
        }
    }

    getTagContent(content) {
        if (content.startsWith('`')) {
            return content.substring(1).trim();
        } else {
            const { args } = this.parseCommand(content);
            return args;
        }
    }

    parseCommand(content) {
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

    parseArgs(argsString) {
        return argsString.split(' ').filter(s => s.length > 0);
    }

}

export default EventHandler;