const config = require('./config.js');
const tagger = require('./tagger.js');

const commandHandler = {
    defaultUnlockMessage: 'henya time!',
    defaultLockMessage: 'see you next time!',

    process: (command, userId, args) => {
        switch (command) {
            case 'tags':
                return tagger.listTags(userId);
            case 'twitch_start':
                return tagger.setStream(args);
            default:
                break;
        }
    },

    processElevated: (command, args) => {
        switch (command) {
            case 'enableopen':
                return setUnlockChannel(true, args);
            case 'disableopen':
                return setUnlockChannel(false, args);
            case 'enableclose':
                return setLockChannel(true, args);
            case 'disableclose':
                return setLockChannel(false, args);
            case 'status':
                return sendStatus();
            case 'tags':
                return tagger.listTags(null);
            case 'checkurl':
                return tagger.getAutoStreamUrl();
            default:
                break;
        }
    },

    setUnlockChannel: (open, message) => {
        config.states.unlockChannel = open;
        if (!!message) {
            config.states.unlockChannelMessage = message;
        } else if (!!config.states.unlockChannelMessage) {
            config.states.unlockMessage = defaultUnlockMessage;
        }
        config.saveState();
        return `${open ? 'Enabled' : 'Disabled'} automatic chat unlock.`;
    },

    setLockChannel: (close, message) => {
        config.states.lockChannel = close;
        if (!!message) {
            config.states.lockMessage = message;
        } else if (!!config.states.lockMessage) {
            config.states.lockMessage = defaultLockMessage;
        }
        config.saveState();
        return `${close ? 'Enabled' : 'Disabled'} automatic chat lock.`
    },

    sendStatus: () => {
        return `Unlock: ${config.states.unlockChannel}, Lock: ${config.states.lockChannel}`;
    }
};

export default commandHandler;