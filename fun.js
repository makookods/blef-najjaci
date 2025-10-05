const { EmbedBuilder } = require('discord.js');

function createEmbed(title, description, color = '#FF69B4') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

module.exports = {
  dicksize: async (message, args) => {
    const targetUser = message.mentions.users.first() || message.author;
    const size = Math.floor(Math.random() * 15) + 1;
    const bar = '='.repeat(size);

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setTitle('🍆 Dick Size')
      .setDescription(`${targetUser}'s size:\n8${bar}D\n**${size} inches**`)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  kiss: async (message, args) => {
    const targetUser = message.mentions.users.first();
    
    if (!targetUser) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .kiss @user', '#FF0000')] });
    }

    if (targetUser.id === message.author.id) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'You cannot kiss yourself!', '#FF0000')] });
    }

    const embed = new EmbedBuilder()
      .setColor('#FF69B4')
      .setTitle('💋 Kiss')
      .setDescription(`${message.author} kissed ${targetUser}! 💕`)
      .setImage('https://media.tenor.com/S59k6TUkuBgAAAAC/anime-kiss.gif')
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  ship: async (message, args) => {
    const user1 = message.mentions.users.first() || message.author;
    const user2 = message.mentions.users.size > 1 ? message.mentions.users.last() : message.guild.members.cache.random().user;

    const percentage = Math.floor(Math.random() * 101);
    const hearts = '❤️'.repeat(Math.floor(percentage / 10));
    const broken = '💔'.repeat(10 - Math.floor(percentage / 10));

    let rating;
    if (percentage < 30) rating = 'Not meant to be... 😢';
    else if (percentage < 60) rating = 'Could work out! 🤔';
    else if (percentage < 80) rating = 'Great match! 😊';
    else rating = 'Perfect match! 💕';

    const embed = new EmbedBuilder()
      .setColor('#FF1493')
      .setTitle('💕 Love Calculator')
      .setDescription(`**${user1.username}** 💘 **${user2.username}**\n\n${hearts}${broken}\n\n**${percentage}%** - ${rating}`)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  yesno: async (message, args) => {
    if (!args.length) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: .yesno <question>', '#FF0000')] });
    }

    const responses = [
      'Yes! ✅',
      'No! ❌',
      'Maybe... 🤔',
      'Definitely! 💯',
      'Absolutely not! 🚫',
      'I don\'t think so... 😕',
      'Without a doubt! ⭐',
      'Not sure... 🤷',
      'Ask again later! ⏰',
      'Most likely! 👍'
    ];

    const answer = responses[Math.floor(Math.random() * responses.length)];
    const question = args.join(' ');

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🎱 Yes or No')
      .addFields(
        { name: '❓ Question', value: question },
        { name: '💬 Answer', value: answer }
      )
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }
};
