import sqlite from 'node:sqlite';
import serverConfig from './serverConfig.json' with { type: 'json' };

const database = new sqlite.DatabaseSync('./livechatbot.db');

const db = {
    createServer: function(guildId) {
        const config = { ...serverConfig };
        config.guildId = guildId;

        try {
            database.exec(`INSERT INTO Servers VALUES (${guildId}, '', '', '', '', '', 0, 0)`);
        } catch (e) {
            console.error(`[${guildId}] Unable to create server config:`, e);
        }

        return config;
    },

    getAllServers: function() {
        try {
            return database.prepare('SELECT * FROM Servers').all();
        } catch (e) {
            console.error('Unable to read server configs:', e);
            return [];
        }
    },

    updateServer: function(guildId, column, value) {
        try {
            if (typeof value === 'boolean') {
                value = value ? 1 : 0;
            }
            database.prepare(`UPDATE Servers SET ${column} = ? WHERE guildId = ?`).run(value, guildId);
        } catch (e) {
            console.error(`[${guildId}] Unable to update server config:`, column, value, e);
        }
    },

    deleteServer: function(guildId) {
        try {
            database.prepare('DELETE FROM Servers WHERE guildId = ?').run(guildId);
        } catch (e) {
            console.error(`[${guildId}] Unable to delete server config:`, e);
        }
    },

    createStream: function(stream) {
        database.prepare('INSERT INTO Streams VALUES (?, ?, ?)').run(
            stream.streamStart.getTime(),
            stream.streamUrl,
            stream.guildId
        );
    },

    getStream(guildId) {
        const stream = database.prepare('SELECT * FROM Streams WHERE guildId = ?').get(guildId) || {};
        if (stream.streamStart) {
            stream.streamStart = new Date(stream.streamStart);
        }
        return stream;
    },

    deleteStream: function(guildId) {
        database.prepare('DELETE FROM Streams WHERE guildId = ?').run(guildId);
    },

    createTag: function(tag) {
        try {
            database.prepare('INSERT INTO Tags VALUES (?, ?, ?, ?, ?, ?, ?)').run(
                tag.authorId,
                tag.messageId,
                tag.message,
                tag.time.getTime(),
                tag.createdAt.getTime(),
                tag.stars,
                tag.guildId
            );
        } catch (e) {
            console.error('Unable to create tag:', tag, e);
        }
    },

    getTags(guildId) {
        const tags = database.prepare('SELECT * FROM Tags WHERE guildId = ? ORDER BY createdAt ASC').all(guildId);
        for (const tag of tags) {
            tag.time = new Date(tag.time);
            tag.createdAt = new Date(tag.createdAt);
        }
        return tags;
    },

    updateTag: function(messageId, column, value) {
        try {
            if (value instanceof Date) {
                value = value.getTime();
            }
            database.prepare(`UPDATE Tags SET ${column} = ? WHERE messageId = ?`).run(value, messageId);
        } catch (e) {
            console.error('Unable to update tag:', messageId, column, value, e);
        }
    },

    deleteTag: function(messageId) {
        database.prepare('DELETE FROM Tags WHERE messageId = ?').run(messageId);
    },

    deleteTags: function(guildId) {
        database.prepare('DELETE FROM Tags WHERE guildId = ?').run(guildId);
    }
};

database.exec('PRAGMA foreign_keys = ON');

database.exec(`
    CREATE TABLE IF NOT EXISTS Servers(
        guildId TEXT PRIMARY KEY,
        liveChatChannel TEXT,
        outputChannel TEXT,
        twitchUserId TEXT,
        unlockMessage TEXT,
        lockMessage TEXT,
        unlockChannel INTEGER,
        lockChannel INTEGER
    ) STRICT
`);

database.exec(`
    CREATE TABLE IF NOT EXISTS Streams(
        streamStart INTEGER,
        streamUrl TEXT,
        guildId TEXT,
        FOREIGN KEY(guildId)
            REFERENCES Servers(guildId)
            ON DELETE CASCADE
    ) STRICT
`);

database.exec(`
    CREATE TABLE IF NOT EXISTS Tags(
        authorId TEXT,
        messageId TEXT,
        message TEXT,
        time INTEGER,
        createdAt INTEGER,
        stars INTEGER,
        guildId TEXT,
        FOREIGN KEY(guildId)
            REFERENCES Servers(guildId)
            ON DELETE CASCADE
    ) STRICT
`);

export default db;