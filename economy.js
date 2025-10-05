const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const { getUser, updateUser, db } = require('../database');

function createEmbed(title, description, color = '#00FF00') {
  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .setDescription(description)
    .setTimestamp();
}

function checkCooldown(lastTime, cooldownMs) {
  if (!lastTime) return true;
  const now = new Date().getTime();
  const last = new Date(lastTime).getTime();
  return now - last >= cooldownMs;
}

module.exports = {
  addmoney: async (message, args) => {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({ embeds: [createEmbed('❌ No Permission', 'You need Administrator permission to use this command.', '#FF0000')] });
    }

    const targetUser = message.mentions.users.first() || await message.guild.members.fetch(args[0]).then(m => m.user).catch(() => null);
    const amount = parseInt(args[1]);

    if (!targetUser || isNaN(amount)) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !addmoney @user <amount>', '#FF0000')] });
    }

    const user = getUser(targetUser.id, message.guild.id);
    updateUser(targetUser.id, message.guild.id, { wallet: user.wallet + amount });

    message.reply({ embeds: [createEmbed('💰 Money Added', `Added **${amount}** coins to ${targetUser.tag}'s wallet!`)] });
  },

  bal: async (message, args) => {
    const targetUser = message.mentions.users.first() || message.author;
    const user = getUser(targetUser.id, message.guild.id);

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('💰 Balance')
      .setThumbnail(targetUser.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '💵 Wallet', value: `${user.wallet} coins`, inline: true },
        { name: '🏦 Bank', value: `${user.bank} coins`, inline: true },
        { name: '💎 Total', value: `${user.wallet + user.bank} coins`, inline: true }
      )
      .setFooter({ text: `${targetUser.tag}`, iconURL: targetUser.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  baltop: async (message, args) => {
    const stmt = db.prepare('SELECT user_id, wallet, bank FROM users WHERE guild_id = ? ORDER BY (wallet + bank) DESC LIMIT 10');
    const users = stmt.all(message.guild.id);

    let description = '';
    for (let i = 0; i < users.length; i++) {
      const user = await message.client.users.fetch(users[i].user_id).catch(() => null);
      const medals = ['🥇', '🥈', '🥉'];
      const medal = i < 3 ? medals[i] : `**${i + 1}.**`;
      description += `${medal} ${user ? user.tag : 'Unknown'} - **${users[i].wallet + users[i].bank}** coins\n`;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🏆 Richest Players')
      .setDescription(description || 'No users found.')
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  daily: async (message, args) => {
    const user = getUser(message.author.id, message.guild.id);

    if (!checkCooldown(user.last_daily, 24 * 60 * 60 * 1000)) {
      return message.reply({ embeds: [createEmbed('⏰ Cooldown', 'You already claimed your daily reward! Come back in 24 hours.', '#FF0000')] });
    }

    const reward = 1000;
    updateUser(message.author.id, message.guild.id, { 
      wallet: user.wallet + reward,
      last_daily: new Date().toISOString()
    });

    message.reply({ embeds: [createEmbed('🎁 Daily Reward', `You claimed your daily reward of **${reward}** coins!`)] });
  },

  deposit: async (message, args) => {
    const user = getUser(message.author.id, message.guild.id);
    let amount = args[0];

    if (amount === 'all') {
      amount = user.wallet;
    } else {
      amount = parseInt(amount);
    }

    if (isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Amount', 'Please specify a valid amount to deposit.', '#FF0000')] });
    }

    if (user.wallet < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money in your wallet!', '#FF0000')] });
    }

    updateUser(message.author.id, message.guild.id, {
      wallet: user.wallet - amount,
      bank: user.bank + amount
    });

    message.reply({ embeds: [createEmbed('🏦 Deposit Successful', `Deposited **${amount}** coins to your bank!`)] });
  },

  withdraw: async (message, args) => {
    const user = getUser(message.author.id, message.guild.id);
    let amount = args[0];

    if (amount === 'all') {
      amount = user.bank;
    } else {
      amount = parseInt(amount);
    }

    if (isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Amount', 'Please specify a valid amount to withdraw.', '#FF0000')] });
    }

    if (user.bank < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money in your bank!', '#FF0000')] });
    }

    updateUser(message.author.id, message.guild.id, {
      wallet: user.wallet + amount,
      bank: user.bank - amount
    });

    message.reply({ embeds: [createEmbed('💵 Withdrawal Successful', `Withdrew **${amount}** coins from your bank!`)] });
  },

  pay: async (message, args) => {
    const targetUser = message.mentions.users.first() || await message.guild.members.fetch(args[0]).then(m => m.user).catch(() => null);
    const amount = parseInt(args[1]);

    if (!targetUser || isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !pay @user <amount>', '#FF0000')] });
    }

    if (targetUser.id === message.author.id) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'You cannot pay yourself!', '#FF0000')] });
    }

    const sender = getUser(message.author.id, message.guild.id);
    if (sender.wallet < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money!', '#FF0000')] });
    }

    const receiver = getUser(targetUser.id, message.guild.id);
    updateUser(message.author.id, message.guild.id, { wallet: sender.wallet - amount });
    updateUser(targetUser.id, message.guild.id, { wallet: receiver.wallet + amount });

    message.reply({ embeds: [createEmbed('💸 Payment Sent', `You sent **${amount}** coins to ${targetUser.tag}!`)] });
  },

  crime: async (message, args) => {
    const user = getUser(message.author.id, message.guild.id);

    if (!checkCooldown(user.last_crime, 30 * 60 * 1000)) {
      return message.reply({ embeds: [createEmbed('⏰ Cooldown', 'You need to wait before committing another crime!', '#FF0000')] });
    }

    const success = Math.random() > 0.5;
    const amount = Math.floor(Math.random() * 500) + 100;

    if (success) {
      updateUser(message.author.id, message.guild.id, {
        wallet: user.wallet + amount,
        last_crime: new Date().toISOString()
      });
      message.reply({ embeds: [createEmbed('🦹 Crime Success', `You successfully committed a crime and earned **${amount}** coins!`, '#00FF00')] });
    } else {
      const fine = Math.floor(amount / 2);
      updateUser(message.author.id, message.guild.id, {
        wallet: Math.max(0, user.wallet - fine),
        last_crime: new Date().toISOString()
      });
      message.reply({ embeds: [createEmbed('🚓 Caught!', `You got caught and paid a fine of **${fine}** coins!`, '#FF0000')] });
    }
  },

  work: async (message, args) => {
    const user = getUser(message.author.id, message.guild.id);

    if (!checkCooldown(user.last_work, 60 * 60 * 1000)) {
      return message.reply({ embeds: [createEmbed('⏰ Cooldown', 'You need to rest before working again!', '#FF0000')] });
    }

    const amount = Math.floor(Math.random() * 300) + 200;
    updateUser(message.author.id, message.guild.id, {
      wallet: user.wallet + amount,
      last_work: new Date().toISOString()
    });

    const jobs = ['coding', 'delivering packages', 'serving coffee', 'teaching', 'cleaning'];
    const job = jobs[Math.floor(Math.random() * jobs.length)];

    message.reply({ embeds: [createEmbed('💼 Work Complete', `You worked as a ${job} and earned **${amount}** coins!`)] });
  },

  slut: async (message, args) => {
    const user = getUser(message.author.id, message.guild.id);

    if (!checkCooldown(user.last_slut, 60 * 60 * 1000)) {
      return message.reply({ embeds: [createEmbed('⏰ Cooldown', 'You need to wait before doing this again!', '#FF0000')] });
    }

    const amount = Math.floor(Math.random() * 400) + 150;
    updateUser(message.author.id, message.guild.id, {
      wallet: user.wallet + amount,
      last_slut: new Date().toISOString()
    });

    message.reply({ embeds: [createEmbed('💋 Success', `You earned **${amount}** coins!`)] });
  },

  sex: async (message, args) => {
    const user = getUser(message.author.id, message.guild.id);

    if (!checkCooldown(user.last_sex, 60 * 60 * 1000)) {
      return message.reply({ embeds: [createEmbed('⏰ Cooldown', 'You need to wait before doing this again!', '#FF0000')] });
    }

    const amount = Math.floor(Math.random() * 500) + 200;
    updateUser(message.author.id, message.guild.id, {
      wallet: user.wallet + amount,
      last_sex: new Date().toISOString()
    });

    message.reply({ embeds: [createEmbed('😏 Success', `You earned **${amount}** coins!`)] });
  },

  coinflip: async (message, args) => {
    const choice = args[0]?.toLowerCase();
    const amount = parseInt(args[1]);

    if (!['heads', 'tails'].includes(choice) || isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !coinflip <heads/tails> <amount>', '#FF0000')] });
    }

    const user = getUser(message.author.id, message.guild.id);
    if (user.wallet < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money!', '#FF0000')] });
    }

    const result = Math.random() > 0.5 ? 'heads' : 'tails';
    const won = result === choice;

    if (won) {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet + amount });
      message.reply({ embeds: [createEmbed('🪙 Coinflip - Win!', `The coin landed on **${result}**!\nYou won **${amount}** coins!`, '#00FF00')] });
    } else {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet - amount });
      message.reply({ embeds: [createEmbed('🪙 Coinflip - Loss', `The coin landed on **${result}**!\nYou lost **${amount}** coins!`, '#FF0000')] });
    }
  },

  blackjack: async (message, args) => {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !blackjack <amount>', '#FF0000')] });
    }

    const user = getUser(message.author.id, message.guild.id);
    if (user.wallet < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money!', '#FF0000')] });
    }

    const getCard = () => Math.floor(Math.random() * 13) + 1;
    const calculateHand = (cards) => {
      let total = 0;
      let aces = 0;
      cards.forEach(card => {
        if (card > 10) total += 10;
        else if (card === 1) { aces++; total += 11; }
        else total += card;
      });
      while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
      }
      return total;
    };

    const playerCards = [getCard(), getCard()];
    const dealerCards = [getCard(), getCard()];
    const playerTotal = calculateHand(playerCards);
    const dealerTotal = calculateHand(dealerCards);

    let result;
    if (playerTotal === 21) {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet + amount * 1.5 });
      result = `🎉 **BLACKJACK!**\nYou won **${Math.floor(amount * 1.5)}** coins!`;
    } else if (playerTotal > 21) {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet - amount });
      result = `💥 **BUST!**\nYou lost **${amount}** coins!`;
    } else if (dealerTotal > 21 || playerTotal > dealerTotal) {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet + amount });
      result = `✅ **YOU WIN!**\nYou won **${amount}** coins!`;
    } else if (playerTotal < dealerTotal) {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet - amount });
      result = `❌ **DEALER WINS!**\nYou lost **${amount}** coins!`;
    } else {
      result = `🤝 **TIE!**\nYour bet was returned.`;
    }

    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🃏 Blackjack')
      .addFields(
        { name: '👤 Your Hand', value: `**${playerTotal}**`, inline: true },
        { name: '🎰 Dealer Hand', value: `**${dealerTotal}**`, inline: true }
      )
      .setDescription(result)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  baccarat: async (message, args) => {
    const bet = args[0]?.toLowerCase();
    const amount = parseInt(args[1]);

    if (!['player', 'banker', 'tie'].includes(bet) || isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !baccarat <player/banker/tie> <amount>', '#FF0000')] });
    }

    const user = getUser(message.author.id, message.guild.id);
    if (user.wallet < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money!', '#FF0000')] });
    }

    const getCard = () => Math.floor(Math.random() * 10);
    const playerScore = (getCard() + getCard()) % 10;
    const bankerScore = (getCard() + getCard()) % 10;

    let result;
    if (playerScore === bankerScore && bet === 'tie') {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet + amount * 8 });
      result = `🎊 **TIE WIN!**\nYou won **${amount * 8}** coins!`;
    } else if (playerScore > bankerScore && bet === 'player') {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet + amount });
      result = `✅ **PLAYER WINS!**\nYou won **${amount}** coins!`;
    } else if (bankerScore > playerScore && bet === 'banker') {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet + amount });
      result = `✅ **BANKER WINS!**\nYou won **${amount}** coins!`;
    } else {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet - amount });
      result = `❌ **YOU LOSE!**\nYou lost **${amount}** coins!`;
    }

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🎴 Baccarat')
      .addFields(
        { name: '👤 Player Score', value: `**${playerScore}**`, inline: true },
        { name: '🎰 Banker Score', value: `**${bankerScore}**`, inline: true }
      )
      .setDescription(result)
      .setTimestamp();

    message.reply({ embeds: [embed] });
  },

  roulette: async (message, args) => {
    const bet = args[0]?.toLowerCase();
    const amount = parseInt(args[1]);

    if (!bet || isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !roulette <red/black/green/0-36> <amount>', '#FF0000')] });
    }

    const user = getUser(message.author.id, message.guild.id);
    if (user.wallet < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money!', '#FF0000')] });
    }

    const number = Math.floor(Math.random() * 37);
    const redNumbers = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
    const color = number === 0 ? 'green' : redNumbers.includes(number) ? 'red' : 'black';

    let won = false;
    let multiplier = 0;

    if (bet === color) {
      won = true;
      multiplier = color === 'green' ? 35 : 2;
    } else if (bet === number.toString()) {
      won = true;
      multiplier = 35;
    }

    if (won) {
      const winnings = amount * multiplier;
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet + winnings });
      message.reply({ embeds: [createEmbed('🎡 Roulette - Win!', `The ball landed on **${number} ${color}**!\nYou won **${winnings}** coins!`, '#00FF00')] });
    } else {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet - amount });
      message.reply({ embeds: [createEmbed('🎡 Roulette - Loss', `The ball landed on **${number} ${color}**!\nYou lost **${amount}** coins!`, '#FF0000')] });
    }
  },

  slots: async (message, args) => {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !slots <amount>', '#FF0000')] });
    }

    const user = getUser(message.author.id, message.guild.id);
    if (user.wallet < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money!', '#FF0000')] });
    }

    const symbols = ['🍒', '🍋', '🍊', '🍇', '7️⃣', '💎'];
    const slot1 = symbols[Math.floor(Math.random() * symbols.length)];
    const slot2 = symbols[Math.floor(Math.random() * symbols.length)];
    const slot3 = symbols[Math.floor(Math.random() * symbols.length)];

    let multiplier = 0;
    if (slot1 === slot2 && slot2 === slot3) {
      multiplier = slot1 === '💎' ? 10 : slot1 === '7️⃣' ? 7 : 5;
    } else if (slot1 === slot2 || slot2 === slot3) {
      multiplier = 2;
    }

    if (multiplier > 0) {
      const winnings = amount * multiplier;
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet + winnings });
      message.reply({ embeds: [createEmbed('🎰 Slots - Win!', `${slot1} | ${slot2} | ${slot3}\n\nYou won **${winnings}** coins!`, '#00FF00')] });
    } else {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet - amount });
      message.reply({ embeds: [createEmbed('🎰 Slots - Loss', `${slot1} | ${slot2} | ${slot3}\n\nYou lost **${amount}** coins!`, '#FF0000')] });
    }
  },

  rob: async (message, args) => {
    const targetUser = message.mentions.users.first();
    if (!targetUser) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !rob @user', '#FF0000')] });
    }

    if (targetUser.id === message.author.id) {
      return message.reply({ embeds: [createEmbed('❌ Error', 'You cannot rob yourself!', '#FF0000')] });
    }

    const robber = getUser(message.author.id, message.guild.id);
    const target = getUser(targetUser.id, message.guild.id);

    if (target.wallet < 100) {
      return message.reply({ embeds: [createEmbed('❌ Failed', 'This user doesn\'t have enough money to rob!', '#FF0000')] });
    }

    const success = Math.random() > 0.5;
    const amount = Math.floor(Math.random() * Math.min(target.wallet, 500));

    if (success) {
      updateUser(message.author.id, message.guild.id, { wallet: robber.wallet + amount });
      updateUser(targetUser.id, message.guild.id, { wallet: target.wallet - amount });
      message.reply({ embeds: [createEmbed('🦹 Robbery Success', `You successfully robbed **${amount}** coins from ${targetUser.tag}!`, '#00FF00')] });
    } else {
      const fine = Math.floor(amount / 2);
      updateUser(message.author.id, message.guild.id, { wallet: Math.max(0, robber.wallet - fine) });
      message.reply({ embeds: [createEmbed('🚓 Caught!', `You got caught and paid a fine of **${fine}** coins!`, '#FF0000')] });
    }
  },

  plinko: async (message, args) => {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !plinko <amount>', '#FF0000')] });
    }

    const user = getUser(message.author.id, message.guild.id);
    if (user.wallet < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money!', '#FF0000')] });
    }

    const multipliers = [0.2, 0.5, 1, 1.5, 2, 3, 2, 1.5, 1, 0.5, 0.2];
    const index = Math.floor(Math.random() * multipliers.length);
    const multiplier = multipliers[index];
    const winnings = Math.floor(amount * multiplier);

    updateUser(message.author.id, message.guild.id, { wallet: user.wallet - amount + winnings });

    const color = multiplier >= 2 ? '#00FF00' : multiplier >= 1 ? '#FFD700' : '#FF0000';
    message.reply({ embeds: [createEmbed('🎲 Plinko', `The chip landed on **${multiplier}x**!\nYou ${multiplier >= 1 ? 'won' : 'lost'} **${Math.abs(winnings - amount)}** coins!`, color)] });
  },

  mines: async (message, args) => {
    const amount = parseInt(args[0]);
    if (isNaN(amount) || amount <= 0) {
      return message.reply({ embeds: [createEmbed('❌ Invalid Usage', 'Usage: !mines <amount>', '#FF0000')] });
    }

    const user = getUser(message.author.id, message.guild.id);
    if (user.wallet < amount) {
      return message.reply({ embeds: [createEmbed('❌ Insufficient Funds', 'You don\'t have enough money!', '#FF0000')] });
    }

    const safe = Math.floor(Math.random() * 5) + 1;
    const hit = Math.random() > 0.4;

    if (hit) {
      const winnings = Math.floor(amount * (1 + safe * 0.5));
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet + winnings - amount });
      message.reply({ embeds: [createEmbed('💎 Mines - Safe!', `You revealed **${safe}** safe spots!\nYou won **${winnings - amount}** coins!`, '#00FF00')] });
    } else {
      updateUser(message.author.id, message.guild.id, { wallet: user.wallet - amount });
      message.reply({ embeds: [createEmbed('💣 Mines - Boom!', `You hit a mine!\nYou lost **${amount}** coins!`, '#FF0000')] });
    }
  }
};
