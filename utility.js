const { EmbedBuilder, ChannelType } = require('discord.js');
const { getUser, updateUser, db } = require('../database');

function createEmbed(title, description, color = '#3498DB') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  test: async (message, args) => {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('Dobrodošao/la na BLEF™')
      .setDescription(`<:blef_citanje:1424007452814344222> • <#1423985864555368498>\n<:blef_uzvicnik:1424007284043808810> • <#1423985862768594969>\n<:blef_upitnik:1424007337957654539> • <#1423985866778611843>`)
      .setThumbnail(message.author.displayAvatarURL({ dynamic: true, size: 256 }))
      .setFooter({ text: `Server sada ima ${message.guild.memberCount} članova.`, iconURL: message.client.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    await message.channel.send({ content: `${message.author}`, embeds: [embed] });
  },

  test2: async (message, args) => {
    const SUPPORTER_ROLE_ID = '1423985770460479490';
    const role = message.guild.roles.cache.get(SUPPORTER_ROLE_ID);

    const embedGot = new EmbedBuilder()
      .setColor('#00FF00')
      .setDescription(`🎊 | ${message.author} got @${role ? role.name : 'Supporter'} for including \`blef\` in their status.`)
      .setFooter({ text: message.client.user.username, iconURL: message.client.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    const embedLost = new EmbedBuilder()
      .setColor('#FF0000')
      .setDescription(`🚫 | ${message.author} lost their role because they didn't include vanity link.`)
      .setFooter({ text: message.client.user.username, iconURL: message.client.user.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    await message.channel.send({ embeds: [embedGot], allowedMentions: { parse: [] } });
    setTimeout(async () => {
      await message.channel.send({ embeds: [embedLost], allowedMentions: { parse: [] } });
    }, 1000);
  },

  afk: async (message, args) => {
    const reason = args.join(' ') || 'No reason provided';
    updateUser(message.author.id, message.guild.id, { afk_status: '1', afk_reason: reason });
    message.reply({ embeds: [createEmbed('💤 AFK Set', `You are now AFK: ${reason}`)] });
  },

  avatar: async (message, args) => {
    const targetUser = message.mentions.users.first() || message.author;
    
    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`${targetUser.username}'s Avatar`)
      .setImage(targetUser.displayAvatarURL({ dynamic: true, size: 4096 }))
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  banner: async (message, args) => {
    const targetUser = message.mentions.users.first() || message.author;
    const fetchedUser = await targetUser.fetch();
    
    if (!fetchedUser.bannerURL()) {
      return message.reply({ embeds: [createEmbed('❌ No Banner', 'This user doesn\'t have a banner!', '#FF0000')] });
    }

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`${targetUser.username}'s Banner`)
      .setImage(fetchedUser.bannerURL({ dynamic: true, size: 4096 }))
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  help: async (message, args) => {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle('📜 Bot Commands')
      .setDescription('Here are all available commands. Use `.` as the prefix.')
      .addFields(
        { name: '💰 Economy', value: '`addmoney, bal, baltop, daily, deposit, withdraw, pay, crime, work, slut, sex, coinflip, blackjack, baccarat, roulette, slots, rob, plinko, mines`', inline: false },
        { name: '🎮 Fun', value: '`dicksize, kiss, ship, yesno`', inline: false },
        { name: '💑 Marriage', value: '`marry, divorce`', inline: false },
        { name: '🛡️ Moderation', value: '`ban, unban, softban, kick, mute, unmute, warn, clearwarnings, purge, addemoji, removeemoji, setmuterole, setwelcomechannel, permission, blacklist, unblacklist, punishments, status`', inline: false },
        { name: '🎉 Giveaways', value: '`giveaway start/end/reroll, timediff`', inline: false },
        { name: '🔒 Security', value: '`mare, cofke`', inline: false },
        { name: '🔧 Utility', value: '`afk, avatar, banner, help, invites, invtop, leaderboard, messages, ping, profile, rank, serverinfo, voice, whois, test, test2`', inline: false }
      )
      .setFooter({ text: 'Use .help for this menu' })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  invites: async (message, args) => {
    const targetUser = message.mentions.users.first() || message.author;
    const user = getUser(targetUser.id, message.guild.id);

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('📨 Invite Count')
      .setDescription(`${targetUser} has **${user.invites}** invites!`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  invtop: async (message, args) => {
    const stmt = db.prepare('SELECT user_id, invites FROM users WHERE guild_id = ? ORDER BY invites DESC LIMIT 10');
    const users = stmt.all(message.guild.id);

    let description = '';
    for (let i = 0; i < users.length; i++) {
      const user = await message.client.users.fetch(users[i].user_id).catch(() => null);
      const medals = ['🥇', '🥈', '🥉'];
      const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
      description += `${medal} ${user ? user.tag : 'Unknown'} - **${users[i].invites}** invites\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('📨 Top Inviters')
      .setDescription(description || 'No data available.')
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  leaderboard: async (message, args) => {
    const type = args[0]?.toLowerCase() || 'xp';

    let stmt, title;
    if (type === 'money') {
      stmt = db.prepare('SELECT user_id, wallet, bank FROM users WHERE guild_id = ? ORDER BY (wallet + bank) DESC LIMIT 10');
      title = '💰 Money Leaderboard';
    } else if (type === 'messages') {
      stmt = db.prepare('SELECT user_id, messages FROM users WHERE guild_id = ? ORDER BY messages DESC LIMIT 10');
      title = '📝 Message Leaderboard';
    } else {
      stmt = db.prepare('SELECT user_id, xp, level FROM users WHERE guild_id = ? ORDER BY level DESC, xp DESC LIMIT 10');
      title = '⭐ XP Leaderboard';
    }

    const users = stmt.all(message.guild.id);

    let description = '';
    for (let i = 0; i < users.length; i++) {
      const user = await message.client.users.fetch(users[i].user_id).catch(() => null);
      const medals = ['🥇', '🥈', '🥉'];
      const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
      
      let value;
      if (type === 'money') value = `${users[i].wallet + users[i].bank} coins`;
      else if (type === 'messages') value = `${users[i].messages} messages`;
      else value = `Level ${users[i].level} (${users[i].xp} XP)`;
      
      description += `${medal} ${user ? user.tag : 'Unknown'} - ${value}\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle(title)
      .setDescription(description || 'No data available.')
      .setFooter({ text: 'Use .leaderboard <xp/money/messages>' })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  messages: async (message, args) => {
    const targetUser = message.mentions.users.first() || message.author;
    const user = getUser(targetUser.id, message.guild.id);

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('📝 Message Count')
      .setDescription(`${targetUser} has sent **${user.messages}** messages!`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  ping: async (message, args) => {
    const sent = await message.reply({ embeds: [createEmbed('🏓 Pong!', 'Calculating...')] });
    const latency = sent.createdTimestamp - message.createdTimestamp;

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🏓 Pong!')
      .addFields(
        { name: '📡 Bot Latency', value: `${latency}ms`, inline: true },
        { name: '💓 API Latency', value: `${Math.round(message.client.ws.ping)}ms`, inline: true }
      )
      .setTimestamp();

    sent.edit({ embeds: [embed] });
  },

  profile: async (message, args) => {
    const targetUser = message.mentions.users.first() || message.author;
    const user = getUser(targetUser.id, message.guild.id);

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`${targetUser.username}'s Profile`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '💰 Balance', value: `${user.wallet + user.bank} coins`, inline: true },
        { name: '⭐ Level', value: `${user.level}`, inline: true },
        { name: '📊 XP', value: `${user.xp}`, inline: true },
        { name: '📝 Messages', value: `${user.messages}`, inline: true },
        { name: '📨 Invites', value: `${user.invites}`, inline: true },
        { name: '💑 Married', value: user.married_to ? `<@${user.married_to}>` : 'Single', inline: true }
      )
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  rank: async (message, args) => {
    const targetUser = message.mentions.users.first() || message.author;
    const user = getUser(targetUser.id, message.guild.id);
    const xpNeeded = user.level * 100;
    const progress = Math.floor((user.xp / xpNeeded) * 20);
    const bar = '█'.repeat(progress) + '░'.repeat(20 - progress);

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`${targetUser.username}'s Rank`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setDescription(`**Level ${user.level}**\n\n${bar}\n${user.xp}/${xpNeeded} XP`)
      .addFields(
        { name: '📝 Messages', value: `${user.messages}`, inline: true },
        { name: '🏆 Next Level', value: `${xpNeeded - user.xp} XP`, inline: true }
      )
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  serverinfo: async (message, args) => {
    const guild = message.guild;
    const owner = await guild.fetchOwner();

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${guild.name} - Server Info`)
      .setThumbnail(guild.iconURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: '👑 Owner', value: `${owner.user.tag}`, inline: true },
        { name: '🆔 Server ID', value: guild.id, inline: true },
        { name: '📅 Created', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '👥 Members', value: `${guild.memberCount}`, inline: true },
        { name: '💬 Channels', value: `${guild.channels.cache.filter(c => c.type !== ChannelType.GuildCategory).size}`, inline: true },
        { name: '😀 Emojis', value: `${guild.emojis.cache.size}`, inline: true },
        { name: '🎭 Roles', value: `${guild.roles.cache.size}`, inline: true },
        { name: '🔒 Verification', value: `${guild.verificationLevel}`, inline: true },
        { name: '🛡️ Boost Tier', value: `${guild.premiumTier}`, inline: true }
      )
      .setTimestamp();

    if (guild.bannerURL()) {
      embed.setImage(guild.bannerURL({ size: 1024 }));
    }

    message.reply({ embeds: [embed] });
  },

  voice: async (message, args) => {
    const targetUser = message.mentions.users.first() || message.author;
    const user = getUser(targetUser.id, message.guild.id);

    const hours = Math.floor(user.voice_time / 3600);
    const minutes = Math.floor((user.voice_time % 3600) / 60);

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🎤 Voice Activity')
      .setDescription(`${targetUser} has been in voice for:\n**${hours}h ${minutes}m**`)
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  whois: async (message, args) => {
    const targetMember = message.mentions.members.first() || message.member;
    const targetUser = targetMember.user;

    const roles = targetMember.roles.cache
      .filter(role => role.id !== message.guild.id)
      .sort((a, b) => b.position - a.position)
      .map(role => role.toString())
      .slice(0, 10)
      .join(', ') || 'None';

    const embed = new EmbedBuilder()
      .setColor(targetMember.displayHexColor)
      .setTitle('👤 User Information')
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 512 }))
      .addFields(
        { name: '📛 Username', value: targetUser.tag, inline: true },
        { name: '🆔 User ID', value: targetUser.id, inline: true },
        { name: '🤖 Bot', value: targetUser.bot ? 'Yes' : 'No', inline: true },
        { name: '📅 Account Created', value: `<t:${Math.floor(targetUser.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '📥 Joined Server', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:R>`, inline: true },
        { name: '🎭 Roles', value: roles, inline: false }
      )
      .setTimestamp();

    if (targetUser.bannerURL()) {
      embed.setImage(targetUser.bannerURL({ size: 1024 }));
    }

    message.reply({ embeds: [embed] });
  }
};
