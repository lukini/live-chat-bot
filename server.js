import Tagger from './tagger.js';
import configManager from './configManager.js';

class Server {
    guildId = 0;
    config = null;
    apiClient = null;
    client = null;
    listener = null;
    tagger = null;
    subs = [];

    channelRegex = /<#(\d+)>/;

    constructor(config, apiClient, client, listener) {
        this.guildId = config.guildId;
        this.apiClient = apiClient;
        this.client = client;
        this.listener = listener;
        this.tagger = new Tagger(apiClient);
        this.config = new Proxy(config, {
            set(target, name, value) {
                if (name in target) {
                    target[name] = value;
                    configManager.save(target);
                    return true;
                }
                return false;
            }
        });
    }

    async streamStartHandler(e) {
        console.log('Stream started at ', e.startDate);
        this.tagger.startStream(e);

        if (this.config.unlockChannel && this.config.liveChatChannel) {
            const channel = this.client.channels.cache.get(this.config.liveChatChannel);
            channel.send({ embeds: [{
                color: 0x00ff99,
                title: 'Channel Unlocked',
                description: `🔓 ${this.config.unlockMessage}`
            }] });
            channel.permissionOverwrites.edit(this.guildId, { SendMessages: null });
        }
    }

    async streamEndHandler() {
        console.log('Stream ended at ', new Date());
        this.tagger.streamEnd = new Date();

        if (this.config.lockChannel && this.config.liveChatChannel) {
            const channel = this.client.channels.cache.get(this.config.liveChatChannel);
            channel.permissionOverwrites.edit(this.guildId, { SendMessages: false });
            channel.send({ embeds: [{
                color: 0xff4444,
                title: 'Channel Locked',
                description: `🔒 ${this.config.lockMessage}`
            }] });
        }
        
        if (this.tagger.streamUrl) {
            const tags = this.tagger.listTags();
            const channel = this.client.channels.cache.get(this.config.outputChannel);
            for (const embed of tags) {
                await channel.send({ embeds: [embed] });
            }
            this.tagger.deleteTags();
        }
    }

    processCommand(message, command, args) {
        switch (command) {
            case 'tags':
                return this.tagger.listTags(message.author.id);
            case 'adjust':
                this.tagger.adjustTime(message, args);
                break;
            default:
                break;
        }
    }

    processCommandElevated(command, args) {
        switch (command) {
            case 'enableopen':
                return this.setUnlockChannel(true, args);
            case 'disableopen':
                return this.setUnlockChannel(false);
            case 'enableclose':
                return this.setLockChannel(true, args);
            case 'disableclose':
                return this.setLockChannel(false);
            case 'livechat':
                return this.setLiveChatChannel(args);
            case 'output':
                return this.setOutputChannel(args);
            case 'track':
                return this.trackUser(args);
            case 'status':
                return this.sendStatus();
            case 'tags':
                return this.tagger.listTags();
            case 'stream':
                return this.tagger.setStreamUrl(args);
            default:
                break;
        }
    }

    setUnlockChannel(open, message) {
        this.config.unlockChannel = open;
        if (message) {
            this.config.unlockMessage = message;
        }
        return this.sendResponse(open, `${open ? 'Enabled' : 'Disabled'} automatic chat unlock`);
    }

    setLockChannel(close, message) {
        this.config.lockChannel = close;
        if (message) {
            this.config.lockMessage = message;
        }
        return this.sendResponse(close, `${close ? 'Enabled' : 'Disabled'} automatic chat lock`);
    }

    setLiveChatChannel(channel) {
        const id = this.parseChannel(channel);
        if (id) {
            this.config.liveChatChannel = channel;
            return this.sendResponse(true, 'Live chat channel set');
        }
    }

    setOutputChannel(channel) {
        const id = this.parseChannel(channel);
        if (id) {
            this.config.outputChannel = channel;
            return this.sendResponse(true, 'Output channel set');
        }
    }

    parseChannel(channel) {
        let result;
        if (!isNaN(parseInt(channel))) {
            result = channel;
        } else if ((result = this.channelRegex.exec(channel)) !== null) {
            result = result[1];
        }

        if (result && this.client.channels.cache.get(result)) {
            return result;
        }
    }

    async trackUser(user) {
        let twitchId;
        if (!isNaN(parseInt(user))) {
            try {
                const twitchUser = await this.apiClient.users.getUserById(user);
                if (twitchUser?.id) {
                    twitchId = user;
                }
            } catch(e) {
                console.log('Failed to get twitch user', e);
            }
        } else {
            try {
                const twitchUser = await this.apiClient.users.getUserByName(user);
                if (twitchUser?.id) {
                    twitchId = twitchUser.id;
                }
            } catch(e) {
                console.log('Failed to get twitch user', e);
            }
        }

        if (twitchId) {
            if (this.config.twitchUserId) {
                this.removeSubscriptions();
            }
            this.config.twitchUserId = twitchId;
            this.addSubscriptions();

            return this.sendResponse(true, `Tracking user id ${twitchId}`);
        }

        return this.sendResponse(false, 'Twitch user not found');
    }

    sendResponse(success, message) {
        return {
            color: success ? 0x00ff99 : 0xff4444,
            description: `${success ? '✅' : '❌'} ${message}`
        };
    }

    sendStatus() {
        return {
            title: 'Status',
            description: `
                **Auto Unlock:** ${ this.config.unlockChannel ? 'on' : 'off' }
                **Auto Lock:** ${ this.config.lockChannel ? 'on' : 'off' }
                **Tagging:** <#${this.config.liveChatChannel}>
                **Output:** <#${this.config.outputChannel}>
                **Tracking User:** ${this.config.twitchUserId}
            `
        };
    }

    addSubscriptions() {
        if (this.config.twitchUserId) {
            console.log('Subscribing to stream events for', this.config.twitchUserId);
            this.subs.push(this.listener.onStreamOnline(this.config.twitchUserId, (e) => this.streamStartHandler(e)));
            this.subs.push(this.listener.onStreamOffline(this.config.twitchUserId, (e) => this.streamEndHandler(e)));
        }
    }

    removeSubscriptions() {
        this.subs.forEach(s => s.stop());
    }
}

export default Server;