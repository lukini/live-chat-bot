const config = require('./config.js');
const tagger = require('./tagger.js');

const commandHandler = {
    defaultUnlockMessage: 'henya time!',
    defaultLockMessage: 'see you next time!',

    process: (message, command, args) => {
        switch (command) {
            case 'tags':
                return tagger.listTags(message.author.id);
            case 'adjust':
                return tagger.adjustTime(message, args);
            case 't':
                return tagger.createTag(message);
            default:
                break;
        }
    },

    processElevated: (command, args) => {
        switch (command) {
            case 'enableopen':
                return this.setUnlockChannel(true, args);
            case 'disableopen':
                return this.setUnlockChannel(false);
            case 'enableclose':
                return this.setLockChannel(true, args);
            case 'disableclose':
                return this.setLockChannel(false);
            case 'status':
                return this.sendStatus();
            case 'tags':
                return tagger.listTags();
            case 'setstream':
                return tagger.setStream(args);
            case 'checkurl':
                return tagger.getAutoStreamUrl();
            default:
                break;
        }
    },

    //TODO: check emoji support
    setUnlockChannel: (open, message) => {
        config.states.unlockChannel = open;
        if (!!message) {
            config.states.unlockMessage = message;
        } else if (open && !config.states.unlockMessage) {
            config.states.unlockMessage = this.defaultUnlockMessage;
        }
        config.saveState();
        return `${open ? 'Enabled' : 'Disabled'} automatic chat unlock.`;
    },

    setLockChannel: (close, message) => {
        config.states.lockChannel = close;
        if (!!message) {
            config.states.lockMessage = message;
        } else if (close && !config.states.lockMessage) {
            config.states.lockMessage = this.defaultLockMessage;
        }
        config.saveState();
        return `${close ? 'Enabled' : 'Disabled'} automatic chat lock.`
    },

    sendStatus: () => {
        return `Unlock: ${config.states.unlockChannel}, Lock: ${config.states.lockChannel}`;
    }
};

export default commandHandler;