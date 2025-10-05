// KEEP-ALIVE WEB SERVER
const express = require("express");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot is running!");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`✅ Web server running on port ${PORT}`);
});
const { Client, GatewayIntentBits, EmbedBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { getUser, updateUser, getGuildSettings, updateGuildSettings, addWarning, getWarnings, clearWarnings, addPunishment, getPunishments, db } = require('./database');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences,
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);
  client.user.setActivity('.help for commands', { type: 0 });
});

client.on('guildMemberAdd', async (member) => {
  const settings = getGuildSettings(member.guild.id);
  
  if (settings.welcome_channel) {
    const channel = member.guild.channels.cache.get(settings.welcome_channel);
    if (channel) {
      const embed = new EmbedBuilder()
        .setColor('#5865F2')
        .setTitle('Dobrodošao/la na BLEF™')
        .setDescription(`<:blef_citanje:1424007452814344222> • <#1423985864555368498>\n<:blef_uzvicnik:1424007284043808810> • <#1423985862768594969>\n<:blef_upitnik:1424007337957654539> • <#1423985866778611843>`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
        .setFooter({ text: `Server sada ima ${member.guild.memberCount} članova.`, iconURL: client.user.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      await channel.send({ content: `${member}`, embeds: [embed] });
    }
  }
  
  updateUser(member.id, member.guild.id, { invites: 0 });
});

client.on('presenceUpdate', async (oldPresence, newPresence) => {
  const SUPPORTER_ROLE_ID = '1423985770460479490';
  const VANITY_CHANNEL_ID = '1423985866778611843';
  const VANITY_TEXT = '/blef';

  if (!newPresence || !newPresence.member) return;

  const member = newPresence.member;
  const guild = member.guild;

  const hasRole = member.roles.cache.has(SUPPORTER_ROLE_ID);

  let hasVanityInStatus = false;
  if (newPresence.activities) {
    for (const activity of newPresence.activities) {
      if (activity.state && activity.state.toLowerCase().includes(VANITY_TEXT.toLowerCase())) {
        hasVanityInStatus = true;
        break;
      }
      if (activity.name && activity.name.toLowerCase().includes(VANITY_TEXT.toLowerCase())) {
        hasVanityInStatus = true;
        break;
      }
    }
  }

  const channel = guild.channels.cache.get(VANITY_CHANNEL_ID);
  if (!channel) return;

  if (hasVanityInStatus && !hasRole) {
    try {
      const role = guild.roles.cache.get(SUPPORTER_ROLE_ID);
      if (role) {
        await member.roles.add(role);
        
        const embed = new EmbedBuilder()
          .setColor('#00FF00')
          .setDescription(`🎊 | ${member} got @${role.name} for including \`blef\` in their status.`)
          .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL({ dynamic: true }) })
          .setTimestamp();

        await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      }
    } catch (error) {
      console.error('Error adding supporter role:', error);
    }
  } else if (!hasVanityInStatus && hasRole) {
    try {
      const role = guild.roles.cache.get(SUPPORTER_ROLE_ID);
      if (role) {
        await member.roles.remove(role);
        
        const embed = new EmbedBuilder()
          .setColor('#FF0000')
          .setDescription(`🚫 | ${member} lost their role because they didn't include vanity link.`)
          .setFooter({ text: client.user.username, iconURL: client.user.displayAvatarURL({ dynamic: true }) })
          .setTimestamp();

        await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
      }
    } catch (error) {
      console.error('Error removing supporter role:', error);
    }
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const user = getUser(message.author.id, message.guild.id);
  
  if (user.blacklisted) return;

  if (user.afk_status) {
    updateUser(message.author.id, message.guild.id, { afk_status: null, afk_reason: null });
    message.reply({ content: '✅ Welcome back! Your AFK status has been removed.', ephemeral: true });
  }

  message.mentions.users.forEach(mentionedUser => {
    const mentionedData = getUser(mentionedUser.id, message.guild.id);
    if (mentionedData.afk_status) {
      message.reply(`💤 ${mentionedUser.tag} is currently AFK: ${mentionedData.afk_reason || 'No reason provided'}`);
    }
  });

  updateUser(message.author.id, message.guild.id, { 
    messages: user.messages + 1,
    xp: user.xp + Math.floor(Math.random() * 10) + 5
  });

  const xpNeeded = user.level * 100;
  if (user.xp >= xpNeeded) {
    updateUser(message.author.id, message.guild.id, { level: user.level + 1 });
  }

  const settings = getGuildSettings(message.guild.id);
  const prefix = settings.prefix;

  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/ +/);
  const command = args.shift().toLowerCase();

  try {
    await handleCommand(message, command, args);
  } catch (error) {
    console.error(`Error executing command ${command}:`, error);
    message.reply({ embeds: [createErrorEmbed('An error occurred while executing the command.')] });
  }
});

async function handleCommand(message, command, args) {
  const economyCommands = require('./commands/economy');
  const funCommands = require('./commands/fun');
  const marriageCommands = require('./commands/marriage');
  const moderationCommands = require('./commands/moderation');
  const giveawayCommands = require('./commands/giveaway');
  const securityCommands = require('./commands/security');
  const utilityCommands = require('./commands/utility');

  const allCommands = {
    ...economyCommands,
    ...funCommands,
    ...marriageCommands,
    ...moderationCommands,
    ...giveawayCommands,
    ...securityCommands,
    ...utilityCommands
  };

  if (allCommands[command]) {
    await allCommands[command](message, args);
  }
}

function createErrorEmbed(description) {
  return new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle('❌ Error')
    .setDescription(description)
    .setTimestamp();
}

client.login(process.env.DISCORD_BOT_TOKEN);
