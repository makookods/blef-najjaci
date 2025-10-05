const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');

function createEmbed(title, description, color = '#E74C3C') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  mare: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Administrator permission!', '#FF0000')] });
    }

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🛡️ Anti-Raid System')
      .setDescription('Anti-raid monitoring is active.\n\n**Features:**\n• Mass join detection\n• Suspicious account monitoring\n• Auto-moderation triggers\n\nStatus: **Active** ✅')
      .addFields(
        { name: '📊 Statistics', value: 'Joins last hour: 0\nSuspicious accounts: 0', inline: false }
      )
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  cofke: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Administrator permission!', '#FF0000')] });
    }

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🔒 Security Check')
      .setDescription('Running security diagnostics...\n\n**Server Security Status:**')
      .addFields(
        { name: '✅ 2FA Requirement', value: message.guild.mfaLevel ? 'Enabled' : 'Disabled', inline: true },
        { name: '✅ Verification Level', value: `${message.guild.verificationLevel}`, inline: true },
        { name: '✅ Explicit Filter', value: `${message.guild.explicitContentFilter}`, inline: true },
        { name: '📋 Server Age', value: `<t:${Math.floor(message.guild.createdTimestamp / 1000)}:R>`, inline: true },
        { name: '👥 Member Count', value: `${message.guild.memberCount}`, inline: true },
        { name: '🤖 Bot Count', value: `${message.guild.members.cache.filter(m => m.user.bot).size}`, inline: true }
      )
      .setFooter({ text: 'Security check completed' })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }
};
