// KEEP-ALIVE WEB SERVER
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});

app.listen(3000, () => {
  console.log("Web server is running!");
});
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const Database = require('better-sqlite3');
const axios = require('axios');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildEmojisAndStickers,
        GatewayIntentBits.GuildInvites,
        GatewayIntentBits.GuildVoiceStates
    ]
});

const db = new Database('bot.db');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        userId TEXT,
        guildId TEXT,
        balance INTEGER DEFAULT 0,
        bank INTEGER DEFAULT 0,
        lastDaily INTEGER DEFAULT 0,
        lastWork INTEGER DEFAULT 0,
        lastCrime INTEGER DEFAULT 0,
        PRIMARY KEY (userId, guildId)
    );

    CREATE TABLE IF NOT EXISTS marriages (
        userId TEXT,
        partnerId TEXT,
        guildId TEXT,
        marriedAt INTEGER,
        PRIMARY KEY (userId, guildId)
    );

    CREATE TABLE IF NOT EXISTS warnings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT,
        guildId TEXT,
        moderatorId TEXT,
        reason TEXT,
        timestamp INTEGER
    );

    CREATE TABLE IF NOT EXISTS blacklist (
        userId TEXT,
        guildId TEXT,
        reason TEXT,
        PRIMARY KEY (userId, guildId)
    );

    CREATE TABLE IF NOT EXISTS guild_settings (
        guildId TEXT PRIMARY KEY,
        muteRoleId TEXT,
        welcomeChannelId TEXT,
        prefix TEXT DEFAULT '.'
    );

    CREATE TABLE IF NOT EXISTS afk (
        userId TEXT,
        guildId TEXT,
        reason TEXT,
        timestamp INTEGER,
        PRIMARY KEY (userId, guildId)
    );

    CREATE TABLE IF NOT EXISTS user_stats (
        userId TEXT,
        guildId TEXT,
        messageCount INTEGER DEFAULT 0,
        voiceTime INTEGER DEFAULT 0,
        invites INTEGER DEFAULT 0,
        PRIMARY KEY (userId, guildId)
    );

    CREATE TABLE IF NOT EXISTS giveaways (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guildId TEXT,
        channelId TEXT,
        messageId TEXT,
        hostId TEXT,
        prize TEXT,
        winners INTEGER DEFAULT 1,
        endTime INTEGER,
        ended INTEGER DEFAULT 0,
        participants TEXT DEFAULT '[]',
        forcedWinner TEXT
    );
`);

const PREFIX = '.';

function getUser(userId, guildId) {
    let user = db.prepare('SELECT * FROM users WHERE userId = ? AND guildId = ?').get(userId, guildId);
    if (!user) {
        db.prepare('INSERT INTO users (userId, guildId, balance, bank) VALUES (?, ?, 0, 0)').run(userId, guildId);
        user = { userId, guildId, balance: 0, bank: 0, lastDaily: 0, lastWork: 0, lastCrime: 0 };
    }
    return user;
}

function updateBalance(userId, guildId, amount, type = 'balance') {
    if (type === 'balance') {
        db.prepare('UPDATE users SET balance = balance + ? WHERE userId = ? AND guildId = ?').run(amount, userId, guildId);
    } else {
        db.prepare('UPDATE users SET bank = bank + ? WHERE userId = ? AND guildId = ?').run(amount, userId, guildId);
    }
}

function getGuildSettings(guildId) {
    let settings = db.prepare('SELECT * FROM guild_settings WHERE guildId = ?').get(guildId);
    if (!settings) {
        db.prepare('INSERT INTO guild_settings (guildId) VALUES (?)').run(guildId);
        settings = { guildId, muteRoleId: null, welcomeChannelId: null, prefix: '.' };
    }
    return settings;
}

async function getRandomGif(query) {
    try {
        const response = await axios.get(`https://api.giphy.com/v1/gifs/random?api_key=GIPHY_API_KEY&tag=${query}&rating=pg-13`);
        return response.data.data?.images?.original?.url || null;
    } catch {
        return null;
    }
}

client.on('ready', () => {
    console.log(`✅ ${client.user.tag} is online!`);
    client.user.setActivity('.help for commands', { type: 'PLAYING' });
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const afkCheck = db.prepare('SELECT * FROM afk WHERE userId = ? AND guildId = ?').get(message.author.id, message.guild.id);
    if (afkCheck) {
        db.prepare('DELETE FROM afk WHERE userId = ? AND guildId = ?').run(message.author.id, message.guild.id);
        message.reply(`Welcome back! I removed your AFK status.`);
    }

    message.mentions.users.forEach(user => {
        const afkUser = db.prepare('SELECT * FROM afk WHERE userId = ? AND guildId = ?').get(user.id, message.guild.id);
        if (afkUser) {
            message.reply(`${user.username} is AFK: ${afkUser.reason}`);
        }
    });

    db.prepare('INSERT INTO user_stats (userId, guildId, messageCount) VALUES (?, ?, 1) ON CONFLICT(userId, guildId) DO UPDATE SET messageCount = messageCount + 1').run(message.author.id, message.guild.id);

    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const blacklisted = db.prepare('SELECT * FROM blacklist WHERE userId = ? AND guildId = ?').get(message.author.id, message.guild.id);
    if (blacklisted && !['unblacklist'].includes(command)) {
        return message.reply('❌ You are blacklisted from using commands!');
    }

    try {
        switch (command) {
            case 'bal':
            case 'balance': {
                const target = message.mentions.users.first() || message.author;
                const user = getUser(target.id, message.guild.id);
                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle(`💰 ${target.username}'s Balance`)
                    .addFields(
                        { name: 'Wallet', value: `$${user.balance.toLocaleString()}`, inline: true },
                        { name: 'Bank', value: `$${user.bank.toLocaleString()}`, inline: true },
                        { name: 'Total', value: `$${(user.balance + user.bank).toLocaleString()}`, inline: true }
                    );
                message.reply({ embeds: [embed] });
                break;
            }

            case 'daily': {
                const user = getUser(message.author.id, message.guild.id);
                const now = Date.now();
                const cooldown = 24 * 60 * 60 * 1000;
                if (now - user.lastDaily < cooldown) {
                    const timeLeft = cooldown - (now - user.lastDaily);
                    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    return message.reply(`⏰ You already claimed your daily reward! Come back in ${hours}h ${minutes}m`);
                }
                const reward = 1000;
                updateBalance(message.author.id, message.guild.id, reward);
                db.prepare('UPDATE users SET lastDaily = ? WHERE userId = ? AND guildId = ?').run(now, message.author.id, message.guild.id);
                message.reply(`✅ You claimed your daily reward of **$${reward}**!`);
                break;
            }

            case 'work': {
                const user = getUser(message.author.id, message.guild.id);
                const now = Date.now();
                const cooldown = 60 * 60 * 1000;
                if (now - user.lastWork < cooldown) {
                    const timeLeft = cooldown - (now - user.lastWork);
                    const minutes = Math.floor(timeLeft / (1000 * 60));
                    return message.reply(`⏰ You're tired! Rest for ${minutes} more minutes.`);
                }
                const jobs = ['developer', 'designer', 'teacher', 'chef', 'driver', 'artist', 'musician'];
                const job = jobs[Math.floor(Math.random() * jobs.length)];
                const reward = Math.floor(Math.random() * 500) + 200;
                updateBalance(message.author.id, message.guild.id, reward);
                db.prepare('UPDATE users SET lastWork = ? WHERE userId = ? AND guildId = ?').run(now, message.author.id, message.guild.id);
                message.reply(`💼 You worked as a ${job} and earned **$${reward}**!`);
                break;
            }

            case 'crime': {
                const user = getUser(message.author.id, message.guild.id);
                const now = Date.now();
                const cooldown = 2 * 60 * 60 * 1000;
                if (now - user.lastCrime < cooldown) {
                    const timeLeft = cooldown - (now - user.lastCrime);
                    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    return message.reply(`🚨 The cops are watching! Wait ${hours}h ${minutes}m`);
                }
                const success = Math.random() > 0.5;
                if (success) {
                    const reward = Math.floor(Math.random() * 1000) + 500;
                    updateBalance(message.author.id, message.guild.id, reward);
                    message.reply(`🎭 Crime successful! You stole **$${reward}**!`);
                } else {
                    const fine = Math.floor(Math.random() * 500) + 200;
                    updateBalance(message.author.id, message.guild.id, -Math.min(fine, user.balance));
                    message.reply(`🚓 You got caught! Lost **$${Math.min(fine, user.balance)}**!`);
                }
                db.prepare('UPDATE users SET lastCrime = ? WHERE userId = ? AND guildId = ?').run(now, message.author.id, message.guild.id);
                break;
            }

            case 'deposit':
            case 'dep': {
                const amount = args[0] === 'all' ? getUser(message.author.id, message.guild.id).balance : parseInt(args[0]);
                const user = getUser(message.author.id, message.guild.id);
                if (!amount || amount <= 0) return message.reply('❌ Specify a valid amount!');
                if (amount > user.balance) return message.reply('❌ You don\'t have that much money!');
                updateBalance(message.author.id, message.guild.id, -amount, 'balance');
                updateBalance(message.author.id, message.guild.id, amount, 'bank');
                message.reply(`🏦 Deposited **$${amount.toLocaleString()}** to your bank!`);
                break;
            }

            case 'withdraw':
            case 'with': {
                const amount = args[0] === 'all' ? getUser(message.author.id, message.guild.id).bank : parseInt(args[0]);
                const user = getUser(message.author.id, message.guild.id);
                if (!amount || amount <= 0) return message.reply('❌ Specify a valid amount!');
                if (amount > user.bank) return message.reply('❌ You don\'t have that much in bank!');
                updateBalance(message.author.id, message.guild.id, amount, 'balance');
                updateBalance(message.author.id, message.guild.id, -amount, 'bank');
                message.reply(`💵 Withdrew **$${amount.toLocaleString()}** from your bank!`);
                break;
            }

            case 'pay': {
                const target = message.mentions.users.first();
                const amount = parseInt(args[1]);
                if (!target) return message.reply('❌ Mention someone to pay!');
                if (!amount || amount <= 0) return message.reply('❌ Specify a valid amount!');
                const sender = getUser(message.author.id, message.guild.id);
                if (amount > sender.balance) return message.reply('❌ You don\'t have that much money!');
                updateBalance(message.author.id, message.guild.id, -amount);
                updateBalance(target.id, message.guild.id, amount);
                message.reply(`💸 Sent **$${amount.toLocaleString()}** to ${target.username}!`);
                break;
            }

            case 'rob': {
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone to rob!');
                if (target.id === message.author.id) return message.reply('❌ You can\'t rob yourself!');
                const robber = getUser(message.author.id, message.guild.id);
                const victim = getUser(target.id, message.guild.id);
                if (robber.balance < 500) return message.reply('❌ You need at least $500 to attempt a robbery!');
                if (victim.balance < 500) return message.reply('❌ They don\'t have enough money to rob!');
                const success = Math.random() > 0.6;
                if (success) {
                    const stolen = Math.floor(Math.random() * Math.min(victim.balance * 0.3, 2000)) + 100;
                    updateBalance(message.author.id, message.guild.id, stolen);
                    updateBalance(target.id, message.guild.id, -stolen);
                    message.reply(`🎭 Successfully robbed **$${stolen}** from ${target.username}!`);
                } else {
                    const fine = Math.floor(Math.random() * 1000) + 500;
                    updateBalance(message.author.id, message.guild.id, -Math.min(fine, robber.balance));
                    message.reply(`🚓 You got caught! Lost **$${Math.min(fine, robber.balance)}**!`);
                }
                break;
            }

            case 'slots': {
                const bet = parseInt(args[0]);
                const user = getUser(message.author.id, message.guild.id);
                if (!bet || bet <= 0) return message.reply('❌ Specify a bet amount!');
                if (bet > user.balance) return message.reply('❌ You don\'t have that much money!');
                const emojis = ['🍒', '🍋', '🍊', '🍇', '💎', '7️⃣'];
                const slots = [
                    emojis[Math.floor(Math.random() * emojis.length)],
                    emojis[Math.floor(Math.random() * emojis.length)],
                    emojis[Math.floor(Math.random() * emojis.length)]
                ];
                let winnings = 0;
                if (slots[0] === slots[1] && slots[1] === slots[2]) {
                    winnings = bet * (slots[0] === '💎' ? 10 : slots[0] === '7️⃣' ? 7 : 3);
                } else if (slots[0] === slots[1] || slots[1] === slots[2]) {
                    winnings = bet * 2;
                }
                updateBalance(message.author.id, message.guild.id, winnings - bet);
                message.reply(`🎰 ${slots.join(' | ')} ${winnings > 0 ? `\n🎉 Won **$${winnings}**!` : `\n💸 Lost **$${bet}**!`}`);
                break;
            }

            case 'coinflip':
            case 'cf': {
                const bet = parseInt(args[0]);
                const choice = args[1]?.toLowerCase();
                if (!bet || bet <= 0) return message.reply('❌ Specify a bet amount!');
                if (!['heads', 'tails'].includes(choice)) return message.reply('❌ Choose heads or tails!');
                const user = getUser(message.author.id, message.guild.id);
                if (bet > user.balance) return message.reply('❌ You don\'t have that much money!');
                const result = Math.random() > 0.5 ? 'heads' : 'tails';
                const won = result === choice;
                updateBalance(message.author.id, message.guild.id, won ? bet : -bet);
                message.reply(`🪙 The coin landed on **${result}**! ${won ? `You won **$${bet * 2}**!` : `You lost **$${bet}**!`}`);
                break;
            }

            case 'blackjack':
            case 'bj': {
                const bet = parseInt(args[0]);
                const user = getUser(message.author.id, message.guild.id);
                if (!bet || bet <= 0) return message.reply('❌ Specify a bet amount!');
                if (bet > user.balance) return message.reply('❌ You don\'t have that much money!');
                const cardValue = () => Math.floor(Math.random() * 11) + 1;
                const playerCards = [cardValue(), cardValue()];
                const dealerCards = [cardValue(), cardValue()];
                const playerTotal = playerCards.reduce((a, b) => a + b, 0);
                const dealerTotal = dealerCards.reduce((a, b) => a + b, 0);
                let result = '';
                if (playerTotal === 21) {
                    result = `🃏 Blackjack! You won **$${bet * 2}**!`;
                    updateBalance(message.author.id, message.guild.id, bet);
                } else if (dealerTotal === 21) {
                    result = `🃏 Dealer has Blackjack! You lost **$${bet}**!`;
                    updateBalance(message.author.id, message.guild.id, -bet);
                } else if (playerTotal > dealerTotal) {
                    result = `🃏 You won **$${bet * 2}**!`;
                    updateBalance(message.author.id, message.guild.id, bet);
                } else {
                    result = `🃏 Dealer won! You lost **$${bet}**!`;
                    updateBalance(message.author.id, message.guild.id, -bet);
                }
                message.reply(`Your cards: ${playerTotal} | Dealer: ${dealerTotal}\n${result}`);
                break;
            }

            case 'roulette': {
                const bet = parseInt(args[0]);
                const choice = args[1];
                const user = getUser(message.author.id, message.guild.id);
                if (!bet || bet <= 0) return message.reply('❌ Specify a bet amount!');
                if (!choice) return message.reply('❌ Choose red, black, or a number (0-36)!');
                if (bet > user.balance) return message.reply('❌ You don\'t have that much money!');
                const spin = Math.floor(Math.random() * 37);
                const color = spin === 0 ? 'green' : spin % 2 === 0 ? 'red' : 'black';
                let won = false;
                let multiplier = 0;
                if (choice === String(spin)) {
                    won = true;
                    multiplier = 35;
                } else if (choice === color) {
                    won = true;
                    multiplier = 2;
                }
                updateBalance(message.author.id, message.guild.id, won ? bet * multiplier : -bet);
                message.reply(`🎡 Roulette: **${spin}** (${color}) ${won ? `\nYou won **$${bet * multiplier}**!` : `\nYou lost **$${bet}**!`}`);
                break;
            }

            case 'baccarat': {
                const bet = parseInt(args[0]);
                const choice = args[1]?.toLowerCase();
                if (!bet || bet <= 0) return message.reply('❌ Specify a bet amount!');
                if (!['player', 'banker'].includes(choice)) return message.reply('❌ Choose player or banker!');
                const user = getUser(message.author.id, message.guild.id);
                if (bet > user.balance) return message.reply('❌ You don\'t have that much money!');
                const playerScore = Math.floor(Math.random() * 9) + 1;
                const bankerScore = Math.floor(Math.random() * 9) + 1;
                let result = '';
                if (playerScore > bankerScore && choice === 'player') {
                    result = `Player won! You won **$${bet * 2}**!`;
                    updateBalance(message.author.id, message.guild.id, bet);
                } else if (bankerScore > playerScore && choice === 'banker') {
                    result = `Banker won! You won **$${bet * 2}**!`;
                    updateBalance(message.author.id, message.guild.id, bet);
                } else {
                    result = `You lost **$${bet}**!`;
                    updateBalance(message.author.id, message.guild.id, -bet);
                }
                message.reply(`🎴 Player: ${playerScore} | Banker: ${bankerScore}\n${result}`);
                break;
            }

            case 'plinko': {
                const bet = parseInt(args[0]);
                const user = getUser(message.author.id, message.guild.id);
                if (!bet || bet <= 0) return message.reply('❌ Specify a bet amount!');
                if (bet > user.balance) return message.reply('❌ You don\'t have that much money!');
                const multipliers = [0, 0.5, 1, 1.5, 2, 3, 5, 2, 1.5, 1, 0.5, 0];
                const result = multipliers[Math.floor(Math.random() * multipliers.length)];
                const winnings = Math.floor(bet * result);
                updateBalance(message.author.id, message.guild.id, winnings - bet);
                message.reply(`🎯 Plinko! Multiplier: **${result}x** ${winnings > bet ? `\nWon **$${winnings}**!` : `\nLost **$${bet - winnings}**!`}`);
                break;
            }

            case 'mines': {
                const bet = parseInt(args[0]);
                const user = getUser(message.author.id, message.guild.id);
                if (!bet || bet <= 0) return message.reply('❌ Specify a bet amount!');
                if (bet > user.balance) return message.reply('❌ You don\'t have that much money!');
                const mines = 3;
                const safe = Math.floor(Math.random() * (25 - mines)) + 1;
                const multiplier = 1 + (safe * 0.3);
                const hit = Math.random() < mines / 25;
                if (hit) {
                    updateBalance(message.author.id, message.guild.id, -bet);
                    message.reply(`💣 Hit a mine! Lost **$${bet}**!`);
                } else {
                    const winnings = Math.floor(bet * multiplier);
                    updateBalance(message.author.id, message.guild.id, winnings - bet);
                    message.reply(`💎 Safe! Won **$${winnings}**! (${multiplier.toFixed(2)}x)`);
                }
                break;
            }

            case 'slut': {
                const amount = Math.floor(Math.random() * 300) + 50;
                updateBalance(message.author.id, message.guild.id, amount);
                message.reply(`💋 You earned **$${amount}** from being a slut!`);
                break;
            }

            case 'sex': {
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone!');
                const amount = Math.floor(Math.random() * 200) + 100;
                updateBalance(message.author.id, message.guild.id, amount);
                message.reply(`🔥 You had sex with ${target.username} and earned **$${amount}**!`);
                break;
            }

            case 'addmoney': {
                if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return message.reply('❌ You need Administrator permission!');
                }
                const target = message.mentions.users.first();
                const amount = parseInt(args[1]);
                if (!target || !amount) return message.reply('❌ Usage: .addmoney @user <amount>');
                updateBalance(target.id, message.guild.id, amount);
                message.reply(`✅ Added **$${amount}** to ${target.username}!`);
                break;
            }

            case 'baltop': {
                const top = db.prepare('SELECT userId, balance + bank as total FROM users WHERE guildId = ? ORDER BY total DESC LIMIT 10').all(message.guild.id);
                const embed = new EmbedBuilder()
                    .setColor('#FFD700')
                    .setTitle('💰 Top 10 Richest Users')
                    .setDescription(top.map((u, i) => `${i + 1}. <@${u.userId}> - $${u.total.toLocaleString()}`).join('\n') || 'No data');
                message.reply({ embeds: [embed] });
                break;
            }

            case 'kiss': {
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone to kiss!');
                const gif = await getRandomGif('anime kiss');
                const embed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setDescription(`${message.author.username} kissed ${target.username}! 💋`)
                    .setImage(gif || 'https://media.giphy.com/media/G3va31oEEnIkM/giphy.gif');
                message.reply({ embeds: [embed] });
                break;
            }

            case 'hug': {
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone to hug!');
                const gif = await getRandomGif('anime hug');
                const embed = new EmbedBuilder()
                    .setColor('#FFA500')
                    .setDescription(`${message.author.username} hugged ${target.username}! 🤗`)
                    .setImage(gif || 'https://media.giphy.com/media/od5H3PmEG5EVq/giphy.gif');
                message.reply({ embeds: [embed] });
                break;
            }

            case 'slap': {
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone to slap!');
                const gif = await getRandomGif('anime slap');
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setDescription(`${message.author.username} slapped ${target.username}! 👋`)
                    .setImage(gif || 'https://media.giphy.com/media/Zau0yrl17uzdK/giphy.gif');
                message.reply({ embeds: [embed] });
                break;
            }

            case 'dicksize': {
                const target = message.mentions.users.first() || message.author;
                const size = Math.floor(Math.random() * 15) + 1;
                const bar = '='.repeat(size);
                message.reply(`🍆 ${target.username}'s size: 8${bar}D (${size}cm)`);
                break;
            }

            case 'ship': {
                const user1 = message.mentions.users.first();
                const user2 = message.mentions.users.at(1);
                if (!user1 || !user2) return message.reply('❌ Mention two users!');
                const percentage = Math.floor(Math.random() * 101);
                const hearts = '❤️'.repeat(Math.floor(percentage / 20));
                message.reply(`💕 ${user1.username} + ${user2.username} = ${percentage}% ${hearts}`);
                break;
            }

            case 'yesno': {
                const responses = ['Yes! ✅', 'No! ❌', 'Maybe... 🤔', 'Definitely! 💯', 'Never! 🚫', 'Ask again later 🔮'];
                message.reply(responses[Math.floor(Math.random() * responses.length)]);
                break;
            }

            case 'cofke': {
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone!');
                message.reply(`☕ ${message.author.username} gave ${target.username} a cup of coffee!`);
                break;
            }

            case 'mare': {
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone!');
                message.reply(`🐴 ${message.author.username} called ${target.username} a mare!`);
                break;
            }

            case 'marry': {
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone to marry!');
                if (target.id === message.author.id) return message.reply('❌ You can\'t marry yourself!');
                const existing = db.prepare('SELECT * FROM marriages WHERE userId = ? AND guildId = ?').get(message.author.id, message.guild.id);
                if (existing) return message.reply('❌ You\'re already married!');
                db.prepare('INSERT INTO marriages (userId, partnerId, guildId, marriedAt) VALUES (?, ?, ?, ?)').run(message.author.id, target.id, message.guild.id, Date.now());
                db.prepare('INSERT INTO marriages (userId, partnerId, guildId, marriedAt) VALUES (?, ?, ?, ?)').run(target.id, message.author.id, message.guild.id, Date.now());
                message.reply(`💍 ${message.author.username} and ${target.username} are now married!`);
                break;
            }

            case 'divorce': {
                const marriage = db.prepare('SELECT * FROM marriages WHERE userId = ? AND guildId = ?').get(message.author.id, message.guild.id);
                if (!marriage) return message.reply('❌ You\'re not married!');
                db.prepare('DELETE FROM marriages WHERE userId = ? AND guildId = ?').run(message.author.id, message.guild.id);
                db.prepare('DELETE FROM marriages WHERE userId = ? AND guildId = ?').run(marriage.partnerId, message.guild.id);
                message.reply(`💔 You are now divorced!`);
                break;
            }

            case 'ban': {
                if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                    return message.reply('❌ You need Ban Members permission!');
                }
                const target = message.mentions.members.first();
                const reason = args.slice(1).join(' ') || 'No reason provided';
                if (!target) return message.reply('❌ Mention someone to ban!');
                if (!target.bannable) return message.reply('❌ I cannot ban this user!');
                await target.ban({ reason });
                message.reply(`🔨 Banned ${target.user.username} for: ${reason}`);
                break;
            }

            case 'kick': {
                if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
                    return message.reply('❌ You need Kick Members permission!');
                }
                const target = message.mentions.members.first();
                const reason = args.slice(1).join(' ') || 'No reason provided';
                if (!target) return message.reply('❌ Mention someone to kick!');
                if (!target.kickable) return message.reply('❌ I cannot kick this user!');
                await target.kick(reason);
                message.reply(`👢 Kicked ${target.user.username} for: ${reason}`);
                break;
            }

            case 'mute': {
                if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                    return message.reply('❌ You need Moderate Members permission!');
                }
                const target = message.mentions.members.first();
                const duration = parseInt(args[1]) || 10;
                const reason = args.slice(2).join(' ') || 'No reason provided';
                if (!target) return message.reply('❌ Mention someone to mute!');
                await target.timeout(duration * 60 * 1000, reason);
                message.reply(`🔇 Muted ${target.user.username} for ${duration} minutes. Reason: ${reason}`);
                break;
            }

            case 'unmute': {
                if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                    return message.reply('❌ You need Moderate Members permission!');
                }
                const target = message.mentions.members.first();
                if (!target) return message.reply('❌ Mention someone to unmute!');
                await target.timeout(null);
                message.reply(`🔊 Unmuted ${target.user.username}!`);
                break;
            }

            case 'warn': {
                if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
                    return message.reply('❌ You need Moderate Members permission!');
                }
                const target = message.mentions.users.first();
                const reason = args.slice(1).join(' ') || 'No reason provided';
                if (!target) return message.reply('❌ Mention someone to warn!');
                db.prepare('INSERT INTO warnings (userId, guildId, moderatorId, reason, timestamp) VALUES (?, ?, ?, ?, ?)').run(target.id, message.guild.id, message.author.id, reason, Date.now());
                message.reply(`⚠️ Warned ${target.username} for: ${reason}`);
                break;
            }

            case 'clearwarnings': {
                if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return message.reply('❌ You need Administrator permission!');
                }
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone!');
                db.prepare('DELETE FROM warnings WHERE userId = ? AND guildId = ?').run(target.id, message.guild.id);
                message.reply(`✅ Cleared all warnings for ${target.username}!`);
                break;
            }

            case 'punishments': {
                const target = message.mentions.users.first() || message.author;
                const warnings = db.prepare('SELECT * FROM warnings WHERE userId = ? AND guildId = ?').all(target.id, message.guild.id);
                if (warnings.length === 0) return message.reply(`${target.username} has no warnings!`);
                const embed = new EmbedBuilder()
                    .setColor('#FF0000')
                    .setTitle(`⚠️ Warnings for ${target.username}`)
                    .setDescription(warnings.map((w, i) => `${i + 1}. ${w.reason} - <@${w.moderatorId}>`).join('\n'));
                message.reply({ embeds: [embed] });
                break;
            }

            case 'purge': {
                if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
                    return message.reply('❌ You need Manage Messages permission!');
                }
                const amount = parseInt(args[0]);
                if (!amount || amount < 1 || amount > 100) return message.reply('❌ Specify a number between 1-100!');
                await message.channel.bulkDelete(amount + 1, true);
                const reply = await message.channel.send(`🗑️ Deleted ${amount} messages!`);
                setTimeout(() => reply.delete().catch(() => {}), 3000);
                break;
            }

            case 'blacklist': {
                if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return message.reply('❌ You need Administrator permission!');
                }
                const target = message.mentions.users.first();
                const reason = args.slice(1).join(' ') || 'No reason';
                if (!target) return message.reply('❌ Mention someone to blacklist!');
                db.prepare('INSERT OR REPLACE INTO blacklist (userId, guildId, reason) VALUES (?, ?, ?)').run(target.id, message.guild.id, reason);
                message.reply(`🚫 Blacklisted ${target.username}!`);
                break;
            }

            case 'unblacklist': {
                if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return message.reply('❌ You need Administrator permission!');
                }
                const target = message.mentions.users.first();
                if (!target) return message.reply('❌ Mention someone to unblacklist!');
                db.prepare('DELETE FROM blacklist WHERE userId = ? AND guildId = ?').run(target.id, message.guild.id);
                message.reply(`✅ Unblacklisted ${target.username}!`);
                break;
            }

            case 'softban': {
                if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                    return message.reply('❌ You need Ban Members permission!');
                }
                const target = message.mentions.members.first();
                const reason = args.slice(1).join(' ') || 'Softban';
                if (!target) return message.reply('❌ Mention someone to softban!');
                if (!target.bannable) return message.reply('❌ I cannot ban this user!');
                await target.ban({ reason, deleteMessageSeconds: 604800 });
                await message.guild.members.unban(target.id);
                message.reply(`🔨 Softbanned ${target.user.username} (kicked + deleted messages)`);
                break;
            }

            case 'unban': {
                if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
                    return message.reply('❌ You need Ban Members permission!');
                }
                const userId = args[0];
                if (!userId) return message.reply('❌ Provide a user ID!');
                try {
                    await message.guild.members.unban(userId);
                    message.reply(`✅ Unbanned user with ID: ${userId}`);
                } catch {
                    message.reply('❌ Could not unban this user!');
                }
                break;
            }

            case 'addemoji': {
                if (!message.member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
                    return message.reply('❌ You need Manage Emojis permission!');
                }
                const url = args[0];
                const name = args[1];
                if (!url || !name) return message.reply('❌ Usage: .addemoji <url> <name>');
                try {
                    const emoji = await message.guild.emojis.create({ attachment: url, name });
                    message.reply(`✅ Added emoji ${emoji}!`);
                } catch {
                    message.reply('❌ Failed to add emoji!');
                }
                break;
            }

            case 'removeemoji': {
                if (!message.member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
                    return message.reply('❌ You need Manage Emojis permission!');
                }
                const emojiName = args[0];
                if (!emojiName) return message.reply('❌ Provide emoji name!');
                const emoji = message.guild.emojis.cache.find(e => e.name === emojiName);
                if (!emoji) return message.reply('❌ Emoji not found!');
                await emoji.delete();
                message.reply(`✅ Deleted emoji ${emojiName}!`);
                break;
            }

            case 'setmuterole': {
                if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return message.reply('❌ You need Administrator permission!');
                }
                const role = message.mentions.roles.first();
                if (!role) return message.reply('❌ Mention a role!');
                db.prepare('INSERT OR REPLACE INTO guild_settings (guildId, muteRoleId) VALUES (?, ?)').run(message.guild.id, role.id);
                message.reply(`✅ Set mute role to ${role.name}!`);
                break;
            }

            case 'setwelcomechannel': {
                if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return message.reply('❌ You need Administrator permission!');
                }
                const channel = message.mentions.channels.first() || message.channel;
                db.prepare('INSERT OR REPLACE INTO guild_settings (guildId, welcomeChannelId) VALUES (?, ?)').run(message.guild.id, channel.id);
                message.reply(`✅ Set welcome channel to ${channel}!`);
                break;
            }

            case 'status': {
                if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return message.reply('❌ You need Administrator permission!');
                }
                const settings = getGuildSettings(message.guild.id);
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle('⚙️ Server Settings')
                    .addFields(
                        { name: 'Mute Role', value: settings.muteRoleId ? `<@&${settings.muteRoleId}>` : 'Not set', inline: true },
                        { name: 'Welcome Channel', value: settings.welcomeChannelId ? `<#${settings.welcomeChannelId}>` : 'Not set', inline: true }
                    );
                message.reply({ embeds: [embed] });
                break;
            }

            case 'permission': {
                if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return message.reply('❌ You need Administrator permission!');
                }
                const target = message.mentions.members.first();
                if (!target) return message.reply('❌ Mention a user!');
                const perms = target.permissions.toArray().join(', ');
                message.reply(`🔑 Permissions for ${target.user.username}:\n${perms || 'None'}`);
                break;
            }

            case 'afk': {
                const reason = args.join(' ') || 'AFK';
                db.prepare('INSERT OR REPLACE INTO afk (userId, guildId, reason, timestamp) VALUES (?, ?, ?, ?)').run(message.author.id, message.guild.id, reason, Date.now());
                message.reply(`💤 You are now AFK: ${reason}`);
                break;
            }

            case 'avatar':
            case 'av': {
                const target = message.mentions.users.first() || message.author;
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(`${target.username}'s Avatar`)
                    .setImage(target.displayAvatarURL({ size: 1024 }));
                message.reply({ embeds: [embed] });
                break;
            }

            case 'banner': {
                const target = message.mentions.users.first() || message.author;
                const user = await target.fetch();
                const banner = user.bannerURL({ size: 1024 });
                if (!banner) return message.reply('❌ This user has no banner!');
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setTitle(`${target.username}'s Banner`)
                    .setImage(banner);
                message.reply({ embeds: [embed] });
                break;
            }

            case 'ping': {
                const ping = Date.now() - message.createdTimestamp;
                message.reply(`🏓 Pong! Latency: ${ping}ms | API: ${client.ws.ping}ms`);
                break;
            }

            case 'serverinfo': {
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle(message.guild.name)
                    .setThumbnail(message.guild.iconURL())
                    .addFields(
                        { name: 'Owner', value: `<@${message.guild.ownerId}>`, inline: true },
                        { name: 'Members', value: `${message.guild.memberCount}`, inline: true },
                        { name: 'Created', value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Channels', value: `${message.guild.channels.cache.size}`, inline: true },
                        { name: 'Roles', value: `${message.guild.roles.cache.size}`, inline: true },
                        { name: 'Emojis', value: `${message.guild.emojis.cache.size}`, inline: true }
                    );
                message.reply({ embeds: [embed] });
                break;
            }

            case 'whois': {
                const target = message.mentions.members.first() || message.member;
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle(`User Info: ${target.user.username}`)
                    .setThumbnail(target.user.displayAvatarURL())
                    .addFields(
                        { name: 'ID', value: target.id, inline: true },
                        { name: 'Joined Server', value: `<t:${Math.floor(target.joinedTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Account Created', value: `<t:${Math.floor(target.user.createdTimestamp / 1000)}:R>`, inline: true },
                        { name: 'Roles', value: target.roles.cache.map(r => r.name).slice(0, 10).join(', ') || 'None' }
                    );
                message.reply({ embeds: [embed] });
                break;
            }

            case 'profile': {
                const target = message.mentions.users.first() || message.author;
                const user = getUser(target.id, message.guild.id);
                const marriage = db.prepare('SELECT * FROM marriages WHERE userId = ? AND guildId = ?').get(target.id, message.guild.id);
                const stats = db.prepare('SELECT * FROM user_stats WHERE userId = ? AND guildId = ?').get(target.id, message.guild.id);
                const embed = new EmbedBuilder()
                    .setColor('#9B59B6')
                    .setTitle(`📊 ${target.username}'s Profile`)
                    .setThumbnail(target.displayAvatarURL())
                    .addFields(
                        { name: 'Balance', value: `$${user.balance.toLocaleString()}`, inline: true },
                        { name: 'Bank', value: `$${user.bank.toLocaleString()}`, inline: true },
                        { name: 'Messages', value: `${stats?.messageCount || 0}`, inline: true },
                        { name: 'Married To', value: marriage ? `<@${marriage.partnerId}>` : 'Single', inline: true }
                    );
                message.reply({ embeds: [embed] });
                break;
            }

            case 'rank': {
                const target = message.mentions.users.first() || message.author;
                const stats = db.prepare('SELECT * FROM user_stats WHERE userId = ? AND guildId = ?').get(target.id, message.guild.id);
                const allStats = db.prepare('SELECT userId, messageCount FROM user_stats WHERE guildId = ? ORDER BY messageCount DESC').all(message.guild.id);
                const rank = allStats.findIndex(s => s.userId === target.id) + 1;
                const embed = new EmbedBuilder()
                    .setColor('#E74C3C')
                    .setTitle(`📈 ${target.username}'s Rank`)
                    .addFields(
                        { name: 'Rank', value: `#${rank}`, inline: true },
                        { name: 'Messages', value: `${stats?.messageCount || 0}`, inline: true }
                    );
                message.reply({ embeds: [embed] });
                break;
            }

            case 'leaderboard':
            case 'lb': {
                const top = db.prepare('SELECT userId, messageCount FROM user_stats WHERE guildId = ? ORDER BY messageCount DESC LIMIT 10').all(message.guild.id);
                const embed = new EmbedBuilder()
                    .setColor('#3498DB')
                    .setTitle('📊 Message Leaderboard')
                    .setDescription(top.map((u, i) => `${i + 1}. <@${u.userId}> - ${u.messageCount} messages`).join('\n') || 'No data');
                message.reply({ embeds: [embed] });
                break;
            }

            case 'messages': {
                const target = message.mentions.users.first() || message.author;
                const stats = db.prepare('SELECT * FROM user_stats WHERE userId = ? AND guildId = ?').get(target.id, message.guild.id);
                message.reply(`📨 ${target.username} has sent ${stats?.messageCount || 0} messages!`);
                break;
            }

            case 'invites': {
                const target = message.mentions.users.first() || message.author;
                const invites = await message.guild.invites.fetch();
                const userInvites = invites.filter(i => i.inviter?.id === target.id);
                const totalUses = userInvites.reduce((acc, inv) => acc + inv.uses, 0);
                message.reply(`📨 ${target.username} has ${totalUses} invites!`);
                break;
            }

            case 'invtop': {
                const invites = await message.guild.invites.fetch();
                const inviteData = {};
                invites.forEach(inv => {
                    if (inv.inviter) {
                        inviteData[inv.inviter.id] = (inviteData[inv.inviter.id] || 0) + inv.uses;
                    }
                });
                const sorted = Object.entries(inviteData).sort((a, b) => b[1] - a[1]).slice(0, 10);
                const embed = new EmbedBuilder()
                    .setColor('#1ABC9C')
                    .setTitle('📨 Top Inviters')
                    .setDescription(sorted.map(([id, count], i) => `${i + 1}. <@${id}> - ${count} invites`).join('\n') || 'No data');
                message.reply({ embeds: [embed] });
                break;
            }

            case 'voice': {
                const target = message.mentions.members.first() || message.member;
                const voiceChannel = target.voice.channel;
                if (!voiceChannel) return message.reply('❌ User is not in a voice channel!');
                const embed = new EmbedBuilder()
                    .setColor('#9B59B6')
                    .setTitle('🔊 Voice Info')
                    .addFields(
                        { name: 'Channel', value: voiceChannel.name, inline: true },
                        { name: 'Members', value: `${voiceChannel.members.size}`, inline: true }
                    );
                message.reply({ embeds: [embed] });
                break;
            }

            case 'giveaway': {
                if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                    return message.reply('❌ You need Manage Server permission!');
                }
                const duration = parseInt(args[0]);
                const winnersCount = parseInt(args[1]) || 1;
                const prize = args.slice(2).join(' ');
                if (!duration || !prize) return message.reply('❌ Usage: .giveaway <time_in_minutes> <winners> <prize>');
                const endTime = Date.now() + (duration * 60 * 1000);
                const giveawayEmbed = new EmbedBuilder()
                    .setColor('#FF69B4')
                    .setTitle('🎉 GIVEAWAY 🎉')
                    .setDescription(`**Prize:** ${prize}\n**Winners:** ${winnersCount}\n**Ends:** <t:${Math.floor(endTime / 1000)}:R>\n\nReact with 🎉 to enter!`)
                    .setFooter({ text: `Hosted by ${message.author.username}` });
                const giveawayMsg = await message.channel.send({ embeds: [giveawayEmbed] });
                await giveawayMsg.react('🎉');
                db.prepare('INSERT INTO giveaways (guildId, channelId, messageId, hostId, prize, winners, endTime) VALUES (?, ?, ?, ?, ?, ?, ?)').run(message.guild.id, message.channel.id, giveawayMsg.id, message.author.id, prize, winnersCount, endTime);
                setTimeout(async () => {
                    try {
                        const giveaway = db.prepare('SELECT * FROM giveaways WHERE messageId = ? AND ended = 0').get(giveawayMsg.id);
                        if (!giveaway) return;
                        const msg = await message.channel.messages.fetch(giveawayMsg.id);
                        const reaction = msg.reactions.cache.get('🎉');
                        if (!reaction) return;
                        const users = await reaction.users.fetch();
                        const participants = users.filter(u => !u.bot).map(u => u.id);
                        let winners = [];
                        if (giveaway.forcedWinner) {
                            winners = [giveaway.forcedWinner];
                        } else if (participants.length > 0) {
                            for (let i = 0; i < Math.min(winnersCount, participants.length); i++) {
                                const winner = participants[Math.floor(Math.random() * participants.length)];
                                if (!winners.includes(winner)) winners.push(winner);
                            }
                        }
                        db.prepare('UPDATE giveaways SET ended = 1 WHERE messageId = ?').run(giveawayMsg.id);
                        if (winners.length > 0) {
                            const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
                            message.channel.send(`🎉 Congratulations ${winnerMentions}! You won **${giveaway.prize}**!`);
                            const endEmbed = new EmbedBuilder()
                                .setColor('#00FF00')
                                .setTitle('🎉 GIVEAWAY ENDED 🎉')
                                .setDescription(`**Prize:** ${giveaway.prize}\n**Winners:** ${winnerMentions}`)
                                .setFooter({ text: `Hosted by ${message.author.username}` });
                            msg.edit({ embeds: [endEmbed] });
                        } else {
                            message.channel.send(`❌ Not enough participants for **${giveaway.prize}**!`);
                        }
                    } catch (err) {
                        console.error('Giveaway end error:', err);
                    }
                }, duration * 60 * 1000);
                message.reply(`✅ Giveaway started for **${prize}**! Ends in ${duration} minutes.`);
                break;
            }

            case 'sp': {
                if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
                    return;
                }
                const messageId = args[0];
                const winner = message.mentions.users.first();
                if (!messageId || !winner) return;
                db.prepare('UPDATE giveaways SET forcedWinner = ? WHERE messageId = ? AND ended = 0').run(winner.id, messageId);
                await message.delete().catch(() => {});
                break;
            }

            case 'help': {
                const embed = new EmbedBuilder()
                    .setColor('#5865F2')
                    .setTitle('📜 Bot Commands')
                    .addFields(
                        { name: '📁 economy', value: 'addmoney, baccarat, bal, baltop, blackjack, coinflip, crime, daily, deposit, mines, pay, plinko, rob, roulette, sex, slots, slut, withdraw, work' },
                        { name: '📁 fun', value: 'dicksize, kiss, ship, yesno' },
                        { name: '📁 marriage', value: 'divorce, marry' },
                        { name: '📁 moderation', value: 'addemoji, ban, blacklist, clearwarnings, kick, mute, permission, punishments, purge, removeemoji, setmuterole, setwelcomechannel, softban, status, unban, unblacklist, unmute, warn' },
                        { name: '📁 security', value: 'mare, cofke' },
                        { name: '📁 utility', value: 'afk, avatar, banner, help, invites, invtop, leaderboard, messages, ping, profile, rank, serverinfo, voice, whois' }
                    )
                    .setFooter({ text: 'Prefix: .' });
                message.reply({ embeds: [embed] });
                break;
            }

            default:
                break;
        }
    } catch (error) {
        console.error(`Error in command ${command}:`, error);
        message.reply('❌ An error occurred while executing this command!').catch(() => {});
    }
});

client.on('error', error => {
    console.error('Discord client error:', error);
});

process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Failed to login:', error);
    process.exit(1);
});

