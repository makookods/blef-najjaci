const Database = require('better-sqlite3');
const db = new Database('bot.db');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    user_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    wallet INTEGER DEFAULT 0,
    bank INTEGER DEFAULT 0,
    xp INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    messages INTEGER DEFAULT 0,
    invites INTEGER DEFAULT 0,
    voice_time INTEGER DEFAULT 0,
    last_daily TEXT,
    last_crime TEXT,
    last_work TEXT,
    last_slut TEXT,
    last_sex TEXT,
    married_to TEXT,
    afk_status TEXT,
    afk_reason TEXT,
    blacklisted INTEGER DEFAULT 0,
    UNIQUE(user_id, guild_id)
  );

  CREATE TABLE IF NOT EXISTS warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT,
    timestamp TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS punishments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    guild_id TEXT NOT NULL,
    type TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    reason TEXT,
    timestamp TEXT NOT NULL,
    duration TEXT
  );

  CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    welcome_channel TEXT,
    mute_role TEXT,
    prefix TEXT DEFAULT '.'
  );

  CREATE TABLE IF NOT EXISTS giveaways (
    message_id TEXT PRIMARY KEY,
    guild_id TEXT NOT NULL,
    channel_id TEXT NOT NULL,
    prize TEXT NOT NULL,
    winners_count INTEGER NOT NULL,
    end_time TEXT NOT NULL,
    host_id TEXT NOT NULL,
    ended INTEGER DEFAULT 0
  );
`);

function getUser(userId, guildId) {
  const stmt = db.prepare('SELECT * FROM users WHERE user_id = ? AND guild_id = ?');
  let user = stmt.get(userId, guildId);
  
  if (!user) {
    const insert = db.prepare('INSERT INTO users (user_id, guild_id) VALUES (?, ?)');
    insert.run(userId, guildId);
    user = stmt.get(userId, guildId);
  }
  
  return user;
}

function updateUser(userId, guildId, data) {
  const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const values = Object.values(data);
  const stmt = db.prepare(`UPDATE users SET ${fields} WHERE user_id = ? AND guild_id = ?`);
  stmt.run(...values, userId, guildId);
}

function getGuildSettings(guildId) {
  const stmt = db.prepare('SELECT * FROM guild_settings WHERE guild_id = ?');
  let settings = stmt.get(guildId);
  
  if (!settings) {
    const insert = db.prepare('INSERT INTO guild_settings (guild_id) VALUES (?)');
    insert.run(guildId);
    settings = stmt.get(guildId);
  }
  
  return settings;
}

function updateGuildSettings(guildId, data) {
  const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
  const values = Object.values(data);
  const stmt = db.prepare(`UPDATE guild_settings SET ${fields} WHERE guild_id = ?`);
  stmt.run(...values, guildId);
}

function addWarning(userId, guildId, moderatorId, reason) {
  const stmt = db.prepare('INSERT INTO warnings (user_id, guild_id, moderator_id, reason, timestamp) VALUES (?, ?, ?, ?, ?)');
  stmt.run(userId, guildId, moderatorId, reason, new Date().toISOString());
}

function getWarnings(userId, guildId) {
  const stmt = db.prepare('SELECT * FROM warnings WHERE user_id = ? AND guild_id = ?');
  return stmt.all(userId, guildId);
}

function clearWarnings(userId, guildId) {
  const stmt = db.prepare('DELETE FROM warnings WHERE user_id = ? AND guild_id = ?');
  stmt.run(userId, guildId);
}

function addPunishment(userId, guildId, type, moderatorId, reason, duration = null) {
  const stmt = db.prepare('INSERT INTO punishments (user_id, guild_id, type, moderator_id, reason, timestamp, duration) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(userId, guildId, type, moderatorId, reason, new Date().toISOString(), duration);
}

function getPunishments(userId, guildId) {
  const stmt = db.prepare('SELECT * FROM punishments WHERE user_id = ? AND guild_id = ?');
  return stmt.all(userId, guildId);
}

module.exports = {
  db,
  getUser,
  updateUser,
  getGuildSettings,
  updateGuildSettings,
  addWarning,
  getWarnings,
  clearWarnings,
  addPunishment,
  getPunishments
};
