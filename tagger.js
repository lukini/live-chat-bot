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
            messageId: message.id,
            message: message.content,
            time: message.createdAt,
            stars: 0
        };
        this.tags[tag.messageId] = tag;
        return tag;
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

    deleteTag: (messageId) => {
        if (this.tags[messageId]) {
            delete this.tags[messageId];
        }
    },

    deleteTags: () => {
        this.tags = [];
    },

    listTags: (userId) => {
        const tagList = userId ?
            this.tags.filter(tag => tag.authorId === userId) :
            this.tags;
        let response = '##Tags:\n';
        const minutes = this.calculateMinutes();
        response += `Stream start ${tagList.length} tags (${(minutes / tagList.length).toPrecision(2)}/min)\n`;
        tagList.forEach(tag => {
            response += `> ${tag.message}`;
            if (tag.stars > 0) {
                response += ` (${tag.stars})`;
            }
            const offset = this.calculateOffset(tag.time);
            response += ` [${offset}](${streamUrl}?t=${offset})\n`;
        })
        return response;
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