import { readdirSync, readFileSync, unlinkSync, writeFile } from 'fs';
import serverConfig from './serverConfig.json' with { type: 'json' };

const dir = './configs';

//TODO: switch to DB
const configManager = {
    create: function(guildId) {
        const config = { ...serverConfig };
        config.guildId = guildId;
        this.save(config);
        return config;
    },

    getForId: function(guildId) {
        return this.getConfig(`${guildId}.json`);
    },

    getConfig: function(filename) {
        try {
            const file = readFileSync(dir + '/' + filename, 'utf8');
            return JSON.parse(file);
        } catch (e) {
            console.error('Unable to read config file:', e);
            return { ...serverConfig };
        }
    },

    getAll: function() {
        try {
            const filenames = readdirSync(dir);
            const configs = [];
            filenames.forEach(filename => {
                configs.push(this.getConfig(filename));
            });
            return configs;
        } catch (e) {
            console.error('Unable to read configs:', e);
            return [];
        }
    },

    save: function(config) {
        writeFile(dir + `/${config.guildId}.json`, JSON.stringify(config), 'utf8', err => err && console.error(err));
    },

    delete: function(guildId) {
        try {
            unlinkSync(`${guildId}.json`);
        } catch (e) {
            console.error('Unable to delete config:', e);
        }
    }
};

export default configManager;