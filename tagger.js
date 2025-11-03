import { EmbedBuilder } from 'discord.js';

const tagger = {
    tags: [],
    streamStart: null,
    streamEnd: null,
    streamUrl: null,
    // testing value
    autoStreamUrl: null,

    setStream: function(url) {
        this.streamUrl = url;
    },

    getAutoStreamUrl: function() {
        return this.autoStreamUrl;
    },

    createTag: async function(message, content) {
        const tag = {
            authorId: message.author.id,
            messageId: message.id,
            message: content,
            time: message.createdAt,
            stars: 0
        };
        await message.react('⭐');
        await message.react('❌');
        this.tags.push(tag);
    },

    adjustTime: function(message, offset) {
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
    },

    addStar: function(messageId) {
        this.getTagByMessageId(messageId).stars++;
    },

    removeStar: function(messageId) {
        this.getTagByMessageId(messageId).stars--;
    },

    editTag: function(messageId, newMessage) {
        this.getTagByMessageId(messageId).message = newMessage;
    },

    deleteTag: function(messageId, userId) {
        const index = this.tags.findIndex(t => t.messageId === messageId);
        if (index >= 0 && (!userId || this.tags[index].authorId === userId)) {
            this.tags.splice(index, 1);
        }
    },

    getTagByMessageId: function(messageId) {
        return this.tags.findLast(t => t.messageId === messageId) || {};
    },

    deleteTags: function() {
        this.tags = [];
        this.streamStart = null;
        this.streamEnd = null;
        this.streamUrl = null;
        // testing value
        this.autoStreamUrl = null;
    },

    listTags: function(userId) {
        let tagList = userId ?
            this.tags.filter(tag => tag.authorId === userId) :
            this.tags;
        tagList = tagList.sort((a, b) => a.time - b.time);
        
        const minutes = this.calculateMinutes();
        let tagInfo = `Stream start: <t:${parseInt(this.streamStart / 1000, 10)}:F>, `;
        tagInfo += `${tagList.length} tags (${(minutes / tagList.length).toPrecision(2)}/min)\n`;

        const title = 'Tags';
        let firstEmbed = true;
        const embeds = [];
        
        for (let i = 0; i < tagList.length; i += 22) {
            const embed = new EmbedBuilder();
            let description = tagList.slice(i, i + 22).map(tag => this.printTag(tag)).join('');

            if (firstEmbed) {
                description = tagInfo + description;
                embed.setTitle(title);
                firstEmbed = false;
            }
            
            embed.setDescription(description)
            embeds.push(embed);
        }

        return embeds;
    },

    printTag: function(tag) {
        let text = `${tag.message}`;
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
    },

    calculateMinutes: function() {
        const start = this.streamStart;
        const end = this.streamEnd || new Date();
        const diffMs = end - start;
        return Math.floor(diffMs / 60000);
    },

    calculateOffset: function(time) {
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

export default tagger;