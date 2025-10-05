const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');
const { db } = require('../database');

function createEmbed(title, description, color = '#9B59B6') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function parseDuration(duration) {
  const match = duration.match(/^(\d+)([smhd])$/);
  if (!match) return null;
  
  const amount = parseInt(match[1]);
  const unit = match[2];
  const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
  
  return amount * multipliers[unit];
}

module.exports = {
  giveaway: async (message, args) => {
    const subCommand = args[0]?.toLowerCase();

    if (subCommand === 'start') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Manage Server permission!', '#FF0000')] });
      }

      const duration = args[1];
      const winners = parseInt(args[2]);
      const prize = args.slice(3).join(' ');

      if (!duration || isNaN(winners) || !prize) {
        return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .giveaway start <duration> <winners> <prize>\nExample: .giveaway start 1h 1 Discord Nitro', '#FF0000')] });
      }

      const durationMs = parseDuration(duration);
      if (!durationMs) {
        return message.reply({ embeds: [createEmbed('❌ Invalid Duration', 'Use format: 10s, 5m, 2h, 1d', '#FF0000')] });
      }

      const endTime = new Date(Date.now() + durationMs);

      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('🎉 GIVEAWAY 🎉')
        .setDescription(`**Prize:** ${prize}\n**Winners:** ${winners}\n**Ends:** <t:${Math.floor(endTime.getTime() / 1000)}:R>\n\nReact with 🎉 to enter!`)
        .setFooter({ text: `Hosted by ${message.author.tag}`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
        .setTimestamp(endTime);

      const giveawayMsg = await message.channel.send({ embeds: [embed] });
      await giveawayMsg.react('🎉');

      const stmt = db.prepare('INSERT INTO giveaways (message_id, guild_id, channel_id, prize, winners_count, end_time, host_id) VALUES (?, ?, ?, ?, ?, ?, ?)');
      stmt.run(giveawayMsg.id, message.guild.id, message.channel.id, prize, winners, endTime.toISOString(), message.author.id);

      message.reply({ embeds: [createEmbed('✅ Giveaway Started', `Giveaway created! Ends in ${duration}.`, '#2ECC71')] });

      setTimeout(async () => {
        await endGiveaway(message.client, giveawayMsg.id);
      }, durationMs);

    } else if (subCommand === 'end') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Manage Server permission!', '#FF0000')] });
      }

      const messageId = args[1];
      if (!messageId) {
        return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .giveaway end <messageID>', '#FF0000')] });
      }

      await endGiveaway(message.client, messageId);
      message.reply({ embeds: [createEmbed('✅ Giveaway Ended', 'The giveaway has been ended early.', '#2ECC71')] });

    } else if (subCommand === 'reroll') {
      if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
        return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Manage Server permission!', '#FF0000')] });
      }

      const messageId = args[1];
      if (!messageId) {
        return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .giveaway reroll <messageID>', '#FF0000')] });
      }

      const stmt = db.prepare('SELECT * FROM giveaways WHERE message_id = ?');
      const giveaway = stmt.get(messageId);

      if (!giveaway) {
        return message.reply({ embeds: [createEmbed('❌ Not Found', 'Giveaway not found!', '#FF0000')] });
      }

      const channel = await message.client.channels.fetch(giveaway.channel_id);
      const giveawayMsg = await channel.messages.fetch(messageId);
      const reaction = giveawayMsg.reactions.cache.get('🎉');

      if (!reaction) {
        return message.reply({ embeds: [createEmbed('❌ Error', 'No entries found!', '#FF0000')] });
      }

      const users = await reaction.users.fetch();
      const entries = users.filter(u => !u.bot);

      if (entries.size === 0) {
        return message.reply({ embeds: [createEmbed('❌ No Entries', 'No valid entries!', '#FF0000')] });
      }

      const winners = entries.random(Math.min(giveaway.winners_count, entries.size));
      const winnersList = Array.isArray(winners) ? winners : [winners];

      await channel.send({ embeds: [createEmbed('🎉 Giveaway Rerolled!', `New winner(s): ${winnersList.map(w => `<@${w.id}>`).join(', ')}\n**Prize:** ${giveaway.prize}`, '#9B59B6')] });
      message.reply({ embeds: [createEmbed('✅ Rerolled', 'New winner(s) selected!', '#2ECC71')] });

    } else {
      message.reply({ embeds: [createEmbed('❌ Invalid Subcommand', 'Usage: .giveaway <start/end/reroll>', '#FF0000')] });
    }
  },

  timediff: async (message, args) => {
    const timestamp = args.join(' ');
    if (!timestamp) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .timediff <date/time>\nExample: .timediff 2024-12-31', '#FF0000')] });
    }

    try {
      const targetDate = new Date(timestamp);
      const now = new Date();
      const diff = targetDate - now;

      if (isNaN(diff)) {
        return message.reply({ embeds: [createEmbed('❌ Invalid Date', 'Please provide a valid date/time!', '#FF0000')] });
      }

      const days = Math.floor(Math.abs(diff) / 86400000);
      const hours = Math.floor((Math.abs(diff) % 86400000) / 3600000);
      const minutes = Math.floor((Math.abs(diff) % 3600000) / 60000);

      const timeString = `${days}d ${hours}h ${minutes}m`;
      const description = diff > 0 
        ? `⏰ Time until ${targetDate.toDateString()}:\n**${timeString}**`
        : `⏰ Time since ${targetDate.toDateString()}:\n**${timeString}**`;

      message.reply({ embeds: [createEmbed('📅 Time Difference', description)] });
    } catch (error) {
      message.reply({ embeds: [createEmbed('❌ Error', 'Failed to parse the date/time!', '#FF0000')] });
    }
  }
};

async function endGiveaway(client, messageId) {
  const stmt = db.prepare('SELECT * FROM giveaways WHERE message_id = ? AND ended = 0');
  const giveaway = stmt.get(messageId);

  if (!giveaway) return;

  try {
    const channel = await client.channels.fetch(giveaway.channel_id);
    const giveawayMsg = await channel.messages.fetch(messageId);
    const reaction = giveawayMsg.reactions.cache.get('🎉');

    if (!reaction) {
      await channel.send({ embeds: [createEmbed('❌ Giveaway Ended', 'No entries!', '#FF0000')] });
      return;
    }

    const users = await reaction.users.fetch();
    const entries = users.filter(u => !u.bot);

    if (entries.size === 0) {
      await channel.send({ embeds: [createEmbed('❌ Giveaway Ended', 'No valid entries!', '#FF0000')] });
      const updateStmt = db.prepare('UPDATE giveaways SET ended = 1 WHERE message_id = ?');
      updateStmt.run(messageId);
      return;
    }

    const winners = entries.random(Math.min(giveaway.winners_count, entries.size));
    const winnersList = Array.isArray(winners) ? winners : [winners];

    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🎊 GIVEAWAY ENDED 🎊')
      .setDescription(`**Prize:** ${giveaway.prize}\n**Winner(s):** ${winnersList.map(w => `<@${w.id}>`).join(', ')}`)
      .setTimestamp();

    await giveawayMsg.edit({ embeds: [embed] });
    await channel.send({ content: `🎉 Congratulations ${winnersList.map(w => `<@${w.id}>`).join(', ')}! You won **${giveaway.prize}**!` });

    const updateStmt = db.prepare('UPDATE giveaways SET ended = 1 WHERE message_id = ?');
    updateStmt.run(messageId);
  } catch (error) {
    console.error('Error ending giveaway:', error);
  }
}
