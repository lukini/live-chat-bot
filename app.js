import { readFileSync } from 'fs';
import { Client, Events, GatewayIntentBits } from 'discord.js';
import { NgrokAdapter } from '@twurple/eventsub-ngrok';
import { EventSubHttpListener } from '@twurple/eventsub-http';
import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import minimist from 'minimist';
import appConfigJson from './appConfig.json' with { type: 'json' };
import db from './db.js';
import Server from './server.js';
import EventHandler from './eventHandler.js';

const args = minimist(process.argv.slice(2));
const appConfig = loadConfig(args);

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.MessageContent
    ] 
});
let eventHandler;

client.once(Events.ClientReady, async () => {
    const authProvider = new AppTokenAuthProvider(appConfig.twitchClientId, appConfig.twitchClientSecret);
    const twitchApi = new ApiClient({ authProvider });
    //TODO: replace ngrok?
    const listener = new EventSubHttpListener({
        apiClient: twitchApi,
        adapter: new NgrokAdapter({
            ngrokConfig: {
                authtoken: appConfig.ngrokAuthToken
            }
        }),
        secret: appConfig.secret
    });

    const servers = [];
    const configs = db.getAllServers();
    for (const config of configs) {
        servers.push(new Server(config, twitchApi, client, listener));
        console.log('Server loaded with id', config.guildId);
    }

    eventHandler = new Proxy(new EventHandler(servers, twitchApi, client, listener), {
        get(target, name) {
            const value = target[name];
            if (value instanceof Function) {
                return async function (...args) {
                    try {
                        return await value.apply(target, args);
                    } catch (e) {
                        console.error('Uncaught error in event handler:', e);
                    }
                };
            }
            return value;
        }
    });

    client.on(Events.GuildCreate, (guild) => { eventHandler.handleServerAddition(guild); });
    client.on(Events.GuildDelete, (guild) => { eventHandler.handleServerRemoval(guild); });
    client.on(Events.MessageCreate, (message) => { eventHandler.handleNewMessage(message); });
    client.on(Events.MessageUpdate, (oldMessage, newMessage) => { eventHandler.handleMessageUpdate(oldMessage, newMessage); });
    client.on(Events.MessageDelete, (message) => { eventHandler.handleMessageDeletion(message); });
    client.on(Events.MessageReactionAdd, (reaction, user) => { eventHandler.handleReactionAdd(reaction, user); });
    client.on(Events.MessageReactionRemove, (reaction, user) => { eventHandler.handleReactionRemove(reaction, user); });
    process.on('SIGTERM', eventHandler.handleProcessEnd);
    process.on('SIGINT', eventHandler.handleProcessEnd);

    listener.start();
});

function loadConfig(args) {
    let config = appConfigJson;
    if (args.config) {
        config = JSON.parse(readFileSync(args.config, 'utf8'));
    }
    return config;
}

client.login(appConfig.token);