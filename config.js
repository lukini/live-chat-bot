const { writeFile } = require('fs');

const configJson = require('./config.json');
const state = require('./state.json');

export const config = {
    ...configJson,
    states: state,
    saveState: () => {
        writeFile('state.json', JSON.stringify(this.states), 'utf8', err => err && console.error(err));
    }
};