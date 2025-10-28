const tagger = {
    tags: [],
    streamStart: null,
    streamEnd: null,
    streamUrl: null,
    // testing value
    autoStreamUrl: null,

    setStream: (url) => {
        this.streamUrl = url;
        return '_';
    },

    getAutoStreamUrl: () => {
        return this.autoStreamUrl;
    },

    createTag: (message) => {
        const tag = {
            authorId: message.author.id,
            message: message.content,
            time: message.createdAt,
            stars: 0
        };
        message.react('⭐').then(() => message.react('❌'))
            .catch(err => err && console.error(err));
        this.tags[message.id] = tag;
    },

    addStar: (messageId) => {
        if (this.tags[messageId]) {
            this.tags[messageId].stars++;
        }
    },

    removeStar: (messageId) => {
        if (this.tags[messageId]?.stars > 0) {
            this.tags[messageId].stars--;
        }
    },

    editTag: (messageId, newMessage) => {
        if (this.tags[messageId]) {
            this.tags[messageId].message = newMessage;
        }
    },

    deleteTag: (messageId, userId) => {
        if (this.tags[messageId] &&
            (!userId || this.tags[messageId].authorId === userId)) {
            delete this.tags[messageId];
        }
    },

    deleteTags: () => {
        this.tags = [];
        this.streamStart = null;
        this.streamEnd = null;
        this.streamUrl = null;
        // testing value
        this.autoStreamUrl = null;
    },

    listTags: (userId) => {
        const tagList = userId ?
            this.tags.filter(tag => tag.authorId === userId) :
            this.tags;
        const lines = [], messages = [];
        lines.push('##Tags:\n');
        const minutes = this.calculateMinutes();
        lines.push(`Stream start ${tagList.length} tags (${(minutes / tagList.length).toPrecision(2)}/min)\n`);
        tagList.forEach((tag, index) => {
            let message = `> ${tag.message}`;
            if (tag.stars > 0) {
                message += ` (${tag.stars})`;
            }
            const offset = this.calculateOffset(tag.time);
            if (this.streamUrl) {
                message += ` [${offset}](${streamUrl}?t=${offset})\n`;
            } else {
                message += ` ${offset}\n`;
            }
            lines.push(message);
        });
        
        for (let i = 0; i < lines.length; i += 22) {
            messages.push(lines.slice(i, i + 22).join(''));
        }
        return messages;
    },

    calculateMinutes: () => {
        const start = this.streamStart;
        const end = this.streamEnd || new Date();
        const diffMs = end - start;
        return Math.floor(diffMs / 60000);
    },

    calculateOffset: (time) => {
        const diffMs = time - streamStart;
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