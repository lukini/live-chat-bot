import { writeFile } from 'fs';

import configJson from './config.json' with { type: 'json' };
import state from './state.json' with { type: 'json' };

const config = {
    ...configJson,
    states: state,
    saveState: function() {
        writeFile('state.json', JSON.stringify(this.states), 'utf8', err => err && console.error(err));
    }
};

export default config;