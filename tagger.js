import db from './db.js';

class Tagger {
    tagsPerEmbed = 22;
    apiClient = null;

    tags = [];
    guildId = null;
    streamStart = null;
    streamEnd = null;
    streamId = null;
    streamUrl = null;

    constructor(guildId, apiClient) {
        this.guildId = guildId;
        this.apiClient = apiClient;
        this.tags = db.getTags(guildId).map(tag => this.createProxy(tag));
        const config = db.getStream(guildId);
        this.streamStart = config.streamStart;
        this.streamUrl = config.streamUrl;
    }

    startStream(startEvent) {
        this.deleteTags();
        this.streamStart = startEvent.startDate;
        this.streamId = startEvent.id;

        setTimeout(() => {
            this.checkForVod(startEvent.broadcasterId, 0);
        }, 30 * 1000); // wait 30 seconds
    }

    async setStreamUrl(url) {
        try {
            const streamId = url.split('/').pop().split('?')[0];
            const video = await this.apiClient.videos.getVideoById(streamId);
            if (video?.creationDate) {
                this.streamId = streamId;
                this.createStream(url, video.creationDate);
                return {
                    color: 0x00ff99,
                    description: `Stream set to ${streamId}`
                };
            }
        } catch (e) {
            console.error('Error getting video: ', e);
        }
        return {
            color: 0xff4444,
            description: 'Error setting stream URL'
        };
    }

    async checkForVod(twitchUserId, retryCount) {
        try {
            const videos = await this.apiClient.videos.getVideosByUser(twitchUserId, {
                type: 'archive',
                limit: 1
            });
            if (videos.data.length !== 0) {
                const latestVideo = videos.data[0];
                console.log(`[${this.guildId}] Latest video ID:`, latestVideo.url);
                if (latestVideo.streamId === this.streamId) {
                    console.log('Matches current stream');
                    this.createStream(latestVideo.url, latestVideo.creationDate);
                    return;
                }
            }
        } catch (e) {
            console.error('Error checking for VOD:', e);
        }
        
        if (retryCount < 5) {
            setTimeout(() => {
                this.checkForVod(twitchUserId, retryCount + 1);
            }, 2 * 60 * 1000); // wait 2 minutes
        }
    }

    createStream(url, date) {
        this.streamUrl = url;
        this.streamStart = date;
        db.createStream(this);
    }

    async createTag(message, content) {
        const tag = this.createProxy({
            authorId: message.author.id,
            messageId: message.id,
            message: content,
            createdAt: message.createdAt,
            time: new Date(message.createdAt.getTime() - (20 * 1000)),
            stars: 0,
            guildId: this.guildId
        });
        db.createTag(tag);
        await message.react('⭐');
        await message.react('❌');
        this.tags.push(tag);
    }

    createProxy(tag) {
        return new Proxy(tag, {
            set(target, name, value) {
                if (name in target) {
                    target[name] = value;
                    db.updateTag(target.messageId, name, value);
                    return true;
                }
                return false;
            }
        });
    }

    adjustTime(message, offset) {
        const tag = this.tags.findLast(t => t.authorId === message.author.id);
        if (tag && offset) {
            offset = parseInt(offset.trim());
            if (isNaN(offset)) {
                message.react('❌');
                return;
            }
            tag.time = new Date(tag.time.getTime() + (offset * 1000));
            message.react('👍');
        }
    }

    addStar(messageId) {
        this.getTagByMessageId(messageId).stars++;
    }

    removeStar(messageId) {
        this.getTagByMessageId(messageId).stars--;
    }

    editTag(messageId, newMessage) {
        this.getTagByMessageId(messageId).message = newMessage;
    }

    deleteTag(messageId, userId) {
        const index = this.tags.findLastIndex(t => t.messageId === messageId);
        if (index >= 0 && (!userId || this.tags[index].authorId === userId)) {
            this.tags.splice(index, 1);
        }
    }

    getTagByMessageId(messageId) {
        return this.tags.findLast(t => t.messageId === messageId) || {};
    }

    deleteTags() {
        this.tags = [];
        this.streamStart = null;
        this.streamEnd = null;
        this.streamId = null;
        this.streamUrl = null;
        db.deleteStream(this.guildId);
        db.deleteTags(this.guildId);
        return {
            color: 0x00ff99,
            description: 'Tags deleted'
        };
    }

    listTags(userId) {
        let tagList = userId ?
            this.tags.filter(tag => tag.authorId === userId) :
            this.tags;
        tagList = tagList.sort((a, b) => a.time - b.time);
        
        const minutes = this.calculateMinutes();
        let tagInfo = `Stream start: <t:${parseInt(this.streamStart / 1000, 10)}:f>, `;
        tagInfo += `${tagList.length} tags (${(tagList.length / minutes).toPrecision(2)}/min)\n`;

        let firstEmbed = true,
            length = 0,
            lines = [];
        const embeds = [];
        
        for (let i = 0; i < tagList.length; i++) {
            const line = this.printTag(tagList[i]);
            lines.push(line);
            length += line.length;

            // make sure the description is under 4096
            if (lines.length === this.tagsPerEmbed ||
                i === tagList.length-1 ||
                length + tagList[i+1].message.length > 3900
            ) {
                const embed = {};
                let description = lines.join('');
                if (firstEmbed) {
                    description = tagInfo + description;
                    embed.title = 'Tags';
                    firstEmbed = false;
                }
                embed.description = description;
                embeds.push(embed);
                length = 0;
                lines = [];
            }
        }

        return embeds;
    }

    getStreamUrl() {
        return this.streamUrl;
    }

    printTag(tag) {
        let text = tag.message;
        if (tag.stars > 0) {
            text += ` (${tag.stars})`;
        }
        const offset = this.calculateOffset(tag.time);
        if (this.streamUrl) {
            text += ` [${offset}](${this.streamUrl}?t=${offset})\n`;
        } else {
            text += ` ${offset}\n`;
        }
        return text;
    }

    calculateMinutes() {
        const start = this.streamStart;
        const end = this.streamEnd || new Date();
        const diffMs = end - start;
        return Math.floor(diffMs / 60000);
    }

    calculateOffset(time) {
        const diffMs = time - this.streamStart;
        const sec = 1000, min = sec * 60, hr = min * 60;
        const diffSec = Math.floor((diffMs % min) / sec);
        const diffMin = Math.floor((diffMs % hr) / min);
        const diffHr = Math.floor(diffMs / hr);
        let timeString = '';
        if (diffHr > 0) {
            timeString += `${diffHr}h`;
        }
        if (!!timeString || diffMin > 0) {
            timeString += `${diffMin}m`;
        }
        timeString += `${diffSec}s`;
        return timeString;
    }
};

export default Tagger;