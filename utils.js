const utils = {
    createEmbed: function(success, message) {
        return {
            color: success ? 0x00ff99 : 0xff4444,
            description: `${success ? '✅' : '❌'} ${message}`
        };
    },

    fetch: async function(message) {
        if (message.partial) {
            try {
                await message.fetch();
            } catch (error) {
                console.error('Couldn\'t fetch message:', error);
                return;
            }
        }
    }
};

export default utils;