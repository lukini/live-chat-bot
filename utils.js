const utils = {
    createEmbed: function(success, message) {
        return {
            color: success ? 0x00ff99 : 0xff4444,
            description: `${success ? '✅' : '❌'} ${message}`
        };
    }
};

export default utils;