import config  from './config.js';
import tagger from './tagger.js';

const commandHandler = {
    defaultUnlockMessage: 'henya time!',
    defaultLockMessage: 'see you next time!',

    process: function(message, command, args) {
        switch (command) {
            case 'tags':
                return tagger.listTags(message.author.id);
            case 'adjust':
                tagger.adjustTime(message, args);
            default:
                break;
        }
    },

    processElevated: function(command, args) {
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
                tagger.setStreamUrl(args);
            default:
                break;
        }
    },

    setUnlockChannel: function(open, message) {
        config.states.unlockChannel = open;
        if (!!message) {
            config.states.unlockMessage = message;
        } else if (open && !config.states.unlockMessage) {
            config.states.unlockMessage = this.defaultUnlockMessage;
        }
        config.saveState();
        return `${open ? 'Enabled' : 'Disabled'} automatic chat unlock`;
    },

    setLockChannel: function(close, message) {
        config.states.lockChannel = close;
        if (!!message) {
            config.states.lockMessage = message;
        } else if (close && !config.states.lockMessage) {
            config.states.lockMessage = this.defaultLockMessage;
        }
        config.saveState();
        return `${close ? 'Enabled' : 'Disabled'} automatic chat lock`;
    },

    sendStatus: function() {
        return `Unlock: ${config.states.unlockChannel}, Lock: ${config.states.lockChannel}`;
    }
};

export default commandHandler;