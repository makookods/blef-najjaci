const { EmbedBuilder } = require('discord.js');
const { getUser, updateUser } = require('../database');

function createEmbed(title, description, color = '#FF69B4') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  marry: async (message, args) => {
    const targetUser = message.mentions.users.first();
    
    if (!targetUser) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .marry @user', '#FF0000')] });
    }

    if (targetUser.id === message.author.id) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'You cannot marry yourself!', '#FF0000')] });
    }

    if (targetUser.bot) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'You cannot marry a bot!', '#FF0000')] });
    }

    const proposer = getUser(message.author.id, message.guild.id);
    const partner = getUser(targetUser.id, message.guild.id);

    if (proposer.married_to) {
      return message.reply({ embeds: [createEmbed('❌ Already Married', 'You are already married! Divorce first.', '#FF0000')] });
    }

    if (partner.married_to) {
      return message.reply({ embeds: [createEmbed('❌ Already Married', 'This user is already married!', '#FF0000')] });
    }

    updateUser(message.author.id, message.guild.id, { married_to: targetUser.id });
    updateUser(targetUser.id, message.guild.id, { married_to: message.author.id });

    const embed = new EmbedBuilder()
      .setColor('#FF1493')
      .setTitle('💍 Marriage')
      .setDescription(`🎊 Congratulations!\n\n${message.author} and ${targetUser} are now married! 💑`)
      .setImage('https://media.tenor.com/fhJiTT15cMoAAAAC/anime-wedding.gif')
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  divorce: async (message, args) => {
    const user = getUser(message.author.id, message.guild.id);

    if (!user.married_to) {
      return message.reply({ embeds: [createEmbed('❌ Not Married', 'You are not married!', '#FF0000')] });
    }

    const partner = await message.client.users.fetch(user.married_to).catch(() => null);

    updateUser(message.author.id, message.guild.id, { married_to: null });
    if (partner) {
      updateUser(partner.id, message.guild.id, { married_to: null });
    }

    const embed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle('💔 Divorce')
      .setDescription(`${message.author} and ${partner ? partner.tag : 'their partner'} are now divorced. 😢`)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }
};
