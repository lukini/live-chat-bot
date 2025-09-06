const { Client, Events, GatewayIntentBits } = require('discord.js');
const { writeFile } = require('fs');
const { EventSubNgrokAdapter, EventSubHttpListener } = require('twitch-eventsub-ngrok');
const { ApiClient } = require('@twurple/api');
const { ClientCredentialsAuthProvider } = require('@twurple/auth');
const config = require('./config.json');
const state = require('./state.json');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ] 
});
let commandChannel;

client.once(Events.ClientReady, () => {
    commandChannel = client.channels.cache.get(config.commandChannel);

    //TODO: register app with twitch, get client id/secret
    const authProvider = new ClientCredentialsAuthProvider(config.clientId, config.clientSecret);
    const apiClient = new ApiClient({ authProvider });
    const listener = new EventSubHttpListener({
        apiClient,
        adapter: new EventSubNgrokAdapter(),
        secret: config.secret
    });

    listener.onStreamOnline(config.userId, () => { unlockChannel(); });
    listener.onStreamOffline(config.userId, () => { lockChannel(); });
});

client.on(Events.MessageCreate, message => {
    if (message.author.bot) return;
    //TODO: support other channels? remove this if so. respond in the same channel
    if (message.channel.id !== config.commandChannel) return;

    handleCommand(message.content.toLowerCase());
});

async function unlockChannel() {
    if (!state.unlockChannel) return;
    const message = 'd?liveunlock henya time!';
    commandChannel.send(message);
}

async function lockChannel() {
    if (!state.lockChannel) return;
    const message = 'd?livelock see you next time!';
    commandChannel.send(message);
}

function handleCommand(command) {
    switch (command) {
        case 'l?enableopen':
            //TODO: optional message?
            setUnlockChannel(true);
            break;
        case 'l?disableopen':
            setUnlockChannel(false);
            break;
        case 'l?enableclose':
            //TODO: optional message?
            setLockChannel(true);
            break;
        case 'l?disableclose':
            setLockChannel(false);
            break;
        case 'l?status':
            sendStatus();
            break;
        default:
            break;
    }
}

function setUnlockChannel(open) {
    state.unlockChannel = open;
    commandChannel.send(`${open ? 'Enabled' : 'Disabled'} automatic chat unlock.`);
    updateStates();
}

function setLockChannel(close) {
    state.lockChannel = close;
    commandChannel.send(`${close ? 'Enabled' : 'Disabled'} automatic chat lock.`);
    updateStates();
}

function updateStates() {
    writeFile('state.json', JSON.stringify(state), 'utf8', err => err && console.error(err));
}

function sendStatus() {
    commandChannel.send(`Unlock: ${state.unlockChannel}, Lock: ${state.lockChannel}`);
}

client.login(config.token);