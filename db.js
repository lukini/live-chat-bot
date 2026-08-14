import sqlite from 'node:sqlite';
import serverConfig from './serverConfig.json' with { type: 'json' };

const database = new sqlite.DatabaseSync('./livechatbot.db');

const db = {
    createServer: function(guildId) {
        const config = { ...serverConfig };
        config.guildId = guildId;

        try {
            database.exec(`INSERT INTO Servers VALUES (${guildId}, '', '', '', '', '', 0, 0, '')`);
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
        database.prepare('INSERT OR IGNORE INTO Streams VALUES (?, ?, ?, ?, ?)').run(
            stream.streamId,
            stream.streamStart ? stream.streamStart.getTime() : null,
            stream.streamEnd ? stream.streamEnd.getTime() : null,
            stream.streamUrl ?? null,
            stream.guildId
        );
    },

    getLatestStream(guildId) {
        const stream = database.prepare('SELECT * FROM Streams WHERE guildId = ? ORDER BY streamStart DESC LIMIT 1').get(guildId);
        if (stream) {
            stream.streamStart = stream.streamStart ? new Date(stream.streamStart) : null;
            stream.streamEnd = stream.streamEnd ? new Date(stream.streamEnd) : null;
        }
        return stream;
    },

    getStreamById(guildId, streamId) {
        const stream = database.prepare('SELECT * FROM Streams WHERE (guildId = ? AND streamId = ?)').get(guildId, streamId);
        return this.convertStream(stream);
    },

    getStreamByUrl(guildId, streamUrl) {
        const stream = database.prepare('SELECT * FROM Streams WHERE (guildId = ? AND streamUrl = ?)').get(guildId, streamUrl);
        return this.convertStream(stream);
    },

    convertStream(stream) {
        if (stream) {
            stream.streamStart = stream.streamStart ? new Date(stream.streamStart) : null;
            stream.streamEnd = stream.streamEnd ? new Date(stream.streamEnd) : null;
        }
        return stream;
    },

    updateStream: function(streamId, video) {
        const startTime = video.creationDate ? video.creationDate.getTime() : null;
        database.prepare('UPDATE Streams SET streamUrl = ?, streamStart = ? WHERE streamId = ?').run(video.url ?? null, startTime, streamId);
    },

    setStreamEndTime: function(streamId, value) {
        database.prepare('UPDATE Streams SET streamEnd = ? WHERE streamId = ?').run(value.getTime(), streamId);
    },

    deleteStream: function(guildId, streamId) {
        database.prepare('DELETE FROM Streams WHERE (guildId = ? AND streamId = ?)').run(guildId, streamId);
    },

    createTag: function(tag) {
        try {
            database.prepare('INSERT INTO Tags VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(
                tag.authorId,
                tag.messageId,
                tag.message,
                tag.time.getTime(),
                tag.createdAt.getTime(),
                tag.stars,
                tag.guildId,
                tag.streamId,
                0
            );
        } catch (e) {
            console.error('Unable to create tag:', tag, e);
        }
    },

    getTags(guildId, streamId) {
        const tags = database.prepare('SELECT * FROM Tags WHERE (guildId = ? AND streamId = ?) ORDER BY createdAt ASC').all(guildId, streamId);
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
            } else if (typeof value === 'boolean') {
                value = value ? 1 : 0;
            }
            database.prepare(`UPDATE Tags SET ${column} = ? WHERE messageId = ?`).run(value, messageId);
        } catch (e) {
            console.error('Unable to update tag:', messageId, column, value, e);
        }
    },

    moveTagsToNewStream: function(guildId, oldStreamId, streamId) {
        try {
            database.prepare('UPDATE Tags SET streamId = ? WHERE (guildId = ? AND streamId = ?)').run(streamId, guildId, oldStreamId);
        } catch (e) {
            console.error('Unable to update tags:', guildId, oldStreamId, streamId, e);
        }
    },

    updateOrphanedTags: function(guildId, streamId) {
        try {
            database.prepare('UPDATE Tags SET streamId = ? WHERE (guildId = ? AND streamId IS NULL)').run(streamId, guildId);
        } catch (e) {
            console.error('Unable to update tags:', guildId, streamId, e);
        }
    },

    deleteOrphanedTags: function(guildId) {
        database.prepare('DELETE FROM Tags WHERE (guildId = ? AND streamId IS NULL)').run(guildId);
    },

    deleteTag: function(messageId) {
        database.prepare('DELETE FROM Tags WHERE messageId = ?').run(messageId);
    },

    deleteMarkedTags: function(guildId) {
        database.prepare('DELETE FROM Tags WHERE (guildId = ? AND deleted = 1)').run(guildId);
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
        lockChannel INTEGER,
        loggingChannel TEXT
    ) STRICT
`);

database.exec(`
    CREATE TABLE IF NOT EXISTS Streams(
        streamId TEXT,
        streamStart INTEGER,
        streamEnd INTEGER,
        streamUrl TEXT,
        guildId TEXT,
        UNIQUE(guildId, streamId),
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
        streamId TEXT,
        deleted INTEGER,
        FOREIGN KEY(guildId)
            REFERENCES Servers(guildId)
            ON DELETE CASCADE
    ) STRICT
`);

export default db;