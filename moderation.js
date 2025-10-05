const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getUser, updateUser, getGuildSettings, updateGuildSettings, addWarning, getWarnings, clearWarnings, addPunishment, getPunishments } = require('../database');

function createEmbed(title, description, color = '#3498DB') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

async function parseUserInput(guild, input) {
  if (!input) return null;
  
  const mentionMatch = input.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return await guild.members.fetch(mentionMatch[1]).catch(() => null);
  }
  
  if (/^\d{17,19}$/.test(input)) {
    return await guild.members.fetch(input).catch(() => null);
  }
  
  return null;
}

module.exports = {
  ban: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Ban Members permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);
    const reason = args.slice(1).join(' ') || 'No reason provided';

    if (!targetMember) {
      return message.reply({ embeds: [createEmbed('❌ Invalid User', 'Please mention a user or provide a valid user ID.', '#FF0000')] });
    }

    if (targetMember.id === message.author.id) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'You cannot ban yourself!', '#FF0000')] });
    }

    if (!targetMember.bannable) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'I cannot ban this user!', '#FF0000')] });
    }

    await targetMember.ban({ reason });
    addPunishment(targetMember.id, message.guild.id, 'ban', message.author.id, reason);

    message.reply({ embeds: [createEmbed('🔨 User Banned', `${targetMember.user.tag} has been banned.\n**Reason:** ${reason}`, '#E74C3C')] });
  },

  unban: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Ban Members permission!', '#FF0000')] });
    }

    const userId = args[0];
    if (!userId || !/^\d{17,19}$/.test(userId)) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .unban <userID>', '#FF0000')] });
    }

    await message.guild.bans.remove(userId).catch(() => null);
    message.reply({ embeds: [createEmbed('✅ User Unbanned', `User with ID ${userId} has been unbanned.`, '#2ECC71')] });
  },

  softban: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Ban Members permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);
    const reason = args.slice(1).join(' ') || 'No reason provided';

    if (!targetMember) {
      return message.reply({ embeds: [createEmbed('❌ Invalid User', 'Please mention a user or provide a valid user ID.', '#FF0000')] });
    }

    if (!targetMember.bannable) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'I cannot softban this user!', '#FF0000')] });
    }

    await targetMember.ban({ reason, days: 7 });
    await message.guild.bans.remove(targetMember.id);
    addPunishment(targetMember.id, message.guild.id, 'softban', message.author.id, reason);

    message.reply({ embeds: [createEmbed('🔨 User Softbanned', `${targetMember.user.tag} has been softbanned (messages deleted).\n**Reason:** ${reason}`, '#E67E22')] });
  },

  kick: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Kick Members permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);
    const reason = args.slice(1).join(' ') || 'No reason provided';

    if (!targetMember) {
      return message.reply({ embeds: [createEmbed('❌ Invalid User', 'Please mention a user or provide a valid user ID.', '#FF0000')] });
    }

    if (targetMember.id === message.author.id) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'You cannot kick yourself!', '#FF0000')] });
    }

    if (!targetMember.kickable) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'I cannot kick this user!', '#FF0000')] });
    }

    await targetMember.kick(reason);
    addPunishment(targetMember.id, message.guild.id, 'kick', message.author.id, reason);

    message.reply({ embeds: [createEmbed('👢 User Kicked', `${targetMember.user.tag} has been kicked.\n**Reason:** ${reason}`, '#E67E22')] });
  },

  mute: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Moderate Members permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);
    const duration = args[1];
    const reason = args.slice(2).join(' ') || 'No reason provided';

    if (!targetMember || !duration) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .mute @user <time> [reason]\nExample: .mute @user 1h spam', '#FF0000')] });
    }

    const timeMatch = duration.match(/^(\d+)([smhd])$/);
    if (!timeMatch) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Time', 'Use format: 10s, 5m, 2h, 1d', '#FF0000')] });
    }

    const amount = parseInt(timeMatch[1]);
    const unit = timeMatch[2];
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    const timeoutMs = amount * multipliers[unit];

    if (timeoutMs > 2419200000) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'Maximum mute duration is 28 days!', '#FF0000')] });
    }

    await targetMember.timeout(timeoutMs, reason);
    addPunishment(targetMember.id, message.guild.id, 'mute', message.author.id, reason, duration);

    message.reply({ embeds: [createEmbed('🔇 User Muted', `${targetMember.user.tag} has been muted for ${duration}.\n**Reason:** ${reason}`, '#95A5A6')] });
  },

  unmute: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Moderate Members permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);

    if (!targetMember) {
      return message.reply({ embeds: [createEmbed('❌ Invalid User', 'Please mention a user or provide a valid user ID.', '#FF0000')] });
    }

    await targetMember.timeout(null);
    message.reply({ embeds: [createEmbed('🔊 User Unmuted', `${targetMember.user.tag} has been unmuted.`, '#2ECC71')] });
  },

  warn: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Moderate Members permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);
    const reason = args.slice(1).join(' ') || 'No reason provided';

    if (!targetMember) {
      return message.reply({ embeds: [createEmbed('❌ Invalid User', 'Please mention a user or provide a valid user ID.', '#FF0000')] });
    }

    addWarning(targetMember.id, message.guild.id, message.author.id, reason);
    const warnings = getWarnings(targetMember.id, message.guild.id);

    message.reply({ embeds: [createEmbed('⚠️ User Warned', `${targetMember.user.tag} has been warned.\n**Reason:** ${reason}\n**Total Warnings:** ${warnings.length}`, '#F39C12')] });
  },

  clearwarnings: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Moderate Members permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);

    if (!targetMember) {
      return message.reply({ embeds: [createEmbed('❌ Invalid User', 'Please mention a user or provide a valid user ID.', '#FF0000')] });
    }

    clearWarnings(targetMember.id, message.guild.id);
    message.reply({ embeds: [createEmbed('✅ Warnings Cleared', `All warnings for ${targetMember.user.tag} have been cleared.`, '#2ECC71')] });
  },

  purge: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Manage Messages permission!', '#FF0000')] });
    }

    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount < 1 || amount > 100) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Amount', 'Please provide a number between 1 and 100.', '#FF0000')] });
    }

    const deleted = await message.channel.bulkDelete(amount + 1, true);
    const reply = await message.channel.send({ embeds: [createEmbed('🗑️ Messages Deleted', `Successfully deleted ${deleted.size - 1} messages.`, '#2ECC71')] });

    setTimeout(() => reply.delete().catch(() => {}), 5000);
  },

  addemoji: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Manage Emojis permission!', '#FF0000')] });
    }

    const url = args[0];
    const name = args[1];

    if (!url || !name) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .addemoji <imageURL> <name>', '#FF0000')] });
    }

    try {
      const emoji = await message.guild.emojis.create({ attachment: url, name });
      message.reply({ embeds: [createEmbed('✅ Emoji Added', `Successfully added ${emoji}!`, '#2ECC71')] });
    } catch (error) {
      message.reply({ embeds: [createEmbed('❌ Error', 'Failed to add emoji. Check the URL and try again.', '#FF0000')] });
    }
  },

  removeemoji: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ManageGuildExpressions)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Manage Emojis permission!', '#FF0000')] });
    }

    const name = args[0];
    if (!name) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .removeemoji <name>', '#FF0000')] });
    }

    const emoji = message.guild.emojis.cache.find(e => e.name === name);
    if (!emoji) {
      return message.reply({ embeds: [createEmbed('❌ Not Found', 'Emoji not found!', '#FF0000')] });
    }

    await emoji.delete();
    message.reply({ embeds: [createEmbed('✅ Emoji Removed', `Successfully removed emoji **${name}**!`, '#2ECC71')] });
  },

  setmuterole: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Administrator permission!', '#FF0000')] });
    }

    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .setmuterole @role', '#FF0000')] });
    }

    updateGuildSettings(message.guild.id, { mute_role: role.id });
    message.reply({ embeds: [createEmbed('✅ Mute Role Set', `Mute role set to ${role}!`, '#2ECC71')] });
  },

  setwelcomechannel: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Administrator permission!', '#FF0000')] });
    }

    const channel = message.mentions.channels.first();
    if (!channel) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .setwelcomechannel #channel', '#FF0000')] });
    }

    updateGuildSettings(message.guild.id, { welcome_channel: channel.id });
    message.reply({ embeds: [createEmbed('✅ Welcome Channel Set', `Welcome channel set to ${channel}!`, '#2ECC71')] });
  },

  permission: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Administrator permission!', '#FF0000')] });
    }

    message.reply({ embeds: [createEmbed('ℹ️ Permissions', 'This command would manage command-specific permissions. Implementation requires custom permission system.', '#3498DB')] });
  },

  blacklist: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Administrator permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);

    if (!targetMember) {
      return message.reply({ embeds: [createEmbed('❌ Invalid User', 'Please mention a user or provide a valid user ID.', '#FF0000')] });
    }

    updateUser(targetMember.id, message.guild.id, { blacklisted: 1 });
    message.reply({ embeds: [createEmbed('🚫 User Blacklisted', `${targetMember.user.tag} can no longer use bot commands.`, '#2C3E50')] });
  },

  unblacklist: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Administrator permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);

    if (!targetMember) {
      return message.reply({ embeds: [createEmbed('❌ Invalid User', 'Please mention a user or provide a valid user ID.', '#FF0000')] });
    }

    updateUser(targetMember.id, message.guild.id, { blacklisted: 0 });
    message.reply({ embeds: [createEmbed('✅ User Unblacklisted', `${targetMember.user.tag} can now use bot commands again.`, '#2ECC71')] });
  },

  punishments: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Moderate Members permission!', '#FF0000')] });
    }

    const targetMember = await parseUserInput(message.guild, args[0]);

    if (!targetMember) {
      return message.reply({ embeds: [createEmbed('❌ Invalid User', 'Please mention a user or provide a valid user ID.', '#FF0000')] });
    }

    const punishments = getPunishments(targetMember.id, message.guild.id);
    const warnings = getWarnings(targetMember.id, message.guild.id);

    let description = `**Total Punishments:** ${punishments.length}\n**Total Warnings:** ${warnings.length}\n\n`;

    if (punishments.length === 0 && warnings.length === 0) {
      description += 'No punishments or warnings found.';
    } else {
      punishments.slice(-5).forEach(p => {
        description += `**${p.type.toUpperCase()}** - ${p.reason}\n*${new Date(p.timestamp).toLocaleDateString()}*\n\n`;
      });
    }

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle(`📋 Punishment History - ${targetMember.user.tag}`)
      .setDescription(description)
      .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  status: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Administrator permission!', '#FF0000')] });
    }

    const status = args.join(' ');
    if (!status) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .status <text>', '#FF0000')] });
    }

    message.client.user.setActivity(status);
    message.reply({ embeds: [createEmbed('✅ Status Updated', `Bot status set to: **${status}**`, '#2ECC71')] });
  }
};
