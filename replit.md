# Overview

This is a Discord bot built with Discord.js v14 that provides a comprehensive suite of 60+ commands for server management, economy systems, fun interactions, moderation tools, giveaways, security features, and utilities. The bot uses better-sqlite3 for local database storage and implements various gaming mechanics, social features, and administrative functions for Discord communities.

**Last Updated**: October 5, 2025 - Complete bot implementation with all requested features

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Database Layer

**Technology**: better-sqlite3 with Write-Ahead Logging (WAL) mode
- **Rationale**: Chosen for its synchronous API, performance benefits, and zero-configuration local storage
- **Schema Design**: Relational structure with user profiles, warnings, punishments, and guild settings
- **Key Tables**:
  - `users`: Stores per-guild user data including economy (wallet/bank), progression (XP/level), activity tracking (messages/voice_time/invites), cooldowns for economy commands, marriage status, and AFK states
  - `warnings`: Tracks moderation warnings with timestamps and moderator attribution
  - `punishments`: Records bans, kicks, and other moderation actions with optional duration support
  - `guild_settings`: Stores per-server configuration (welcome channels, mute roles, prefix settings)
  - `giveaways`: Manages active and ended giveaways with prize, winner count, and end times

**Design Pattern**: Direct database access through exported functions (getUser, updateUser, etc.) providing abstraction layer between commands and raw SQL operations

## Bot Architecture

**Framework**: Discord.js v14
- **Event-Driven Design**: Core bot functionality responds to Discord gateway events
- **Intent-Based Permissions**: Explicitly requests required gateway intents (Guilds, Members, Messages, Voice States, Invites)
- **Command Structure**: Message-based prefix commands (using `.` prefix)
- **Command Prefix**: Default prefix is `.` (configurable per guild in database)

**Key Components**:

1. **Command System**
   - Modular command organization by category (economy, fun, marriage, moderation, security, utility, giveaway)
   - Each module exports command handlers as object methods
   - Commands receive message context and parsed arguments
   - Consistent embed-based responses using helper functions
   - **All Commands**: 60+ total commands across 7 categories
   - **Test Command**: `.test` command for previewing welcome messages

2. **Event Handlers**
   - `ready`: Bot initialization and status setting (displays ".help for commands")
   - `guildMemberAdd`: Welcome message system with custom Serbian embeds, member avatar thumbnail, and member count
   - `messageCreate`: Primary command router, XP/leveling system, AFK status management, mention detection, blacklist checking

3. **Economy System**
   - Dual-currency model (wallet for liquid funds, bank for storage)
   - Cooldown-based earning commands (daily, crime, work, sex/slut)
   - Gambling games (blackjack, baccarat, roulette, coinflip, mines, plinko, slots)
   - User-to-user transactions (pay, rob)
   - Administrative money management

4. **Moderation Tools**
   - Permission-gated commands using PermissionFlagsBits
   - Warning and punishment tracking with database persistence
   - Support for temporary punishments (duration field)
   - User input parsing supporting mentions, IDs, and usernames

5. **Social Features**
   - Marriage system with mutual status tracking
   - Fun interaction commands (kiss, ship, dicksize)
   - AFK status with automatic removal on message
   - Invite tracking integration

## External Dependencies

**Primary Dependencies**:
- **discord.js (v14.22.1)**: Core Discord API wrapper providing gateway connection, event handling, and API abstractions
- **better-sqlite3 (v12.4.1)**: Native SQLite3 binding for Node.js with synchronous API

**Discord API Integration**:
- Gateway v10 connection for real-time events
- Embed system for rich message formatting
- Button/ActionRow components for interactive elements (referenced in giveaway system)
- Member caching and fetching for user operations
- Guild-based data isolation (all user data scoped to guild_id)

**No External Services**: Bot operates entirely on local storage without third-party API dependencies, authentication services, or cloud databases

**Asset Dependencies**: References custom Discord emojis (blef_* prefixed) and external GIF URLs (tenor.com) for embed enrichment