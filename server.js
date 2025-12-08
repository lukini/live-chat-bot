import Tagger from './tagger.js';
import db from './db.js';

class Server {
    guildId = 0;
    config = null;
    twitchApi = null;
    client = null;
    listener = null;
    tagger = null;
    subs = [];

    channelRegex = /<#(\d+)>/;

    constructor(config, twitchApi, client, listener) {
        this.guildId = config.guildId;
        this.twitchApi = twitchApi;
        this.client = client;
        this.listener = listener;
        this.tagger = new Tagger(config.guildId, twitchApi);
        this.config = new Proxy(config, {
            set(target, name, value) {
                if (name in target) {
                    target[name] = value;
                    db.updateServer(target.guildId, name, value);
                    return true;
                }
                return false;
            }
        });
        this.addSubscriptions();
    }

    async streamStartHandler(e) {
        console.log(`[${this.guildId}] Stream started at`, e.startDate);
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
        console.log(`[${this.guildId}] Stream ended at`, new Date());
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
            case 'openmessage':
                return this.setUnlockMessage(args);
            case 'closemessage':
                return this.setLockMessage(args);
            case 'livechat':
                return this.setLiveChatChannel(args);
            case 'output':
                return this.setOutputChannel(args);
            case 'track':
                return this.trackUser(args);
            case 'status':
                return this.sendStatus();
            case 'checkurl':
                return this.tagger.getStreamUrl();
            case 'tags':
                return this.tagger.listTags();
            case 'deletetags':
                return this.tagger.deleteTags();
            case 'stream':
            case 'setstream':
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
        return this.createEmbed(open, `${open ? 'Enabled' : 'Disabled'} automatic chat unlock`);
    }

    setLockChannel(close, message) {
        this.config.lockChannel = close;
        if (message) {
            this.config.lockMessage = message;
        }
        return this.createEmbed(close, `${close ? 'Enabled' : 'Disabled'} automatic chat lock`);
    }

    setUnlockMessage(message) {
        this.config.unlockMessage = message;
        return this.createEmbed(true, `Message set to ${message}`);
    }

    setLockMessage(message) {
        this.config.lockMessage = message;
        return this.createEmbed(true, `Message set to ${message}`);
    }

    setLiveChatChannel(channel) {
        return this.setChannel('liveChatChannel', channel);
    }

    setOutputChannel(channel) {
        return this.setChannel('outputChannel', channel);
    }

    setChannel(ref, id) {
        let result;
        if (!isNaN(parseInt(id))) {
            result = id;
        } else if ((result = this.channelRegex.exec(id)) !== null) {
            result = result[1];
        }

        if (result) {
            const channel = this.client.channels.cache.get(result);
            if (channel?.guildId === this.guildId) {
                this.config[ref] = result;
                return this.createEmbed(true, 'Channel set');
            } else {
                return this.createEmbed(false, 'Channel not found');
            }
        } else {
            this.config[ref] = null;
            return this.createEmbed(false, 'Channel removed');
        }
    }

    async trackUser(user) {
        if (!user?.trim()) {
            this.config.twitchUserId = null;
            this.removeSubscriptions();
            return this.createEmbed(true, 'Stopped tracking user');
        }

        let twitchId;
        try {
            if (!isNaN(parseInt(user))) {
                const twitchUser = await this.twitchApi.users.getUserById(user);
                if (twitchUser?.id) {
                    twitchId = user;
                }
            } else {
                const twitchUser = await this.twitchApi.users.getUserByName(user);
                if (twitchUser?.id) {
                    twitchId = twitchUser.id;
                }
            }
        } catch(e) {
            console.log(`[${this.guildId}] Failed to get twitch user`, e);
        }

        if (twitchId) {
            if (this.config.twitchUserId) {
                this.removeSubscriptions();
            }
            this.config.twitchUserId = twitchId;
            this.addSubscriptions();

            return this.createEmbed(true, `Tracking user id ${twitchId}`);
        }

        return this.createEmbed(false, 'Twitch user not found');
    }

    createEmbed(success, message) {
        return {
            color: success ? 0x00ff99 : 0xff4444,
            description: `${success ? '✅' : '❌'} ${message}`
        };
    }

    sendStatus() {
        return {
            title: 'Status',
            description:
                `**Auto Unlock:** ${ this.config.unlockChannel ? 'on' : 'off' }\n` +
                `**Auto Lock:** ${ this.config.lockChannel ? 'on' : 'off' }\n` +
                `**Tagging:** ${ this.config.liveChatChannel ? `<#${this.config.liveChatChannel}>` : 'not set' }\n` +
                `**Output:** ${ this.config.outputChannel ? `<#${this.config.outputChannel}>` : 'not set' }\n` +
                `**Tracking User:** ${ this.config.twitchUserId ? this.config.twitchUserId : 'none' }\n`
        };
    }

    addSubscriptions() {
        if (this.config.twitchUserId) {
            console.log(`[${this.guildId}] Subscribing to stream events for`, this.config.twitchUserId);
            this.subs.push(this.listener.onStreamOnline(this.config.twitchUserId, (e) => this.streamStartHandler(e)));
            this.subs.push(this.listener.onStreamOffline(this.config.twitchUserId, (e) => this.streamEndHandler(e)));
        }
    }

    removeSubscriptions() {
        this.subs.forEach(s => s.stop());
        this.subs = [];
    }
}

export default Server;