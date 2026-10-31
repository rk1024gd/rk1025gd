import 'dotenv/config';
import express from 'express';
import { 
    Client, 
    GatewayIntentBits, 
    REST, 
    Routes, 
    SlashCommandBuilder, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} from 'discord.js';

// 1. Setup Express Keep-Alive Web Server for Render
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Discord Event Bot is active and running!');
});

app.listen(PORT, () => {
    console.log(`Keep-alive web server listening on port ${PORT}`);
});

// 2. Initialize Discord Gateway Client
const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds
    ] 
});

// In-memory storage for active event rosters
const activeEvents = new Map();

// Define slash commands safely (without /check)
const commands = [
    new SlashCommandBuilder()
        .setName('join')
        .setDescription('Create an event sign-up list')
        .addStringOption(option => 
            option.setName('event')
                .setDescription('The title of the event')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('time')
                .setDescription('The time of the event (e.g., 8:00 PM EST)')
                .setRequired(true)
        )
        .addStringOption(option => 
            option.setName('description')
                .setDescription('Additional details about the event')
                .setRequired(false)
        ),
    new SlashCommandBuilder()
        .setName('help')
        .setDescription('Show instructions for using the event bot')
].map(command => command.toJSON());

// Helper function to build dynamic event embeds
function createEventEmbed(title, time, description, participants) {
    const listText = participants.length > 0 
        ? participants.map((user, index) => `${index + 1}. <@${user.id}>`).join('\n')
        : '*No participants yet! Click "Join Event" below.*';

    const embed = new EmbedBuilder()
        .setTitle(`📅 Event: ${title}`)
        .setColor(0x5865F2)
        .addFields(
            { name: '🕒 Time', value: time, inline: false },
            { name: `Participants (${participants.length})`, value: listText, inline: false }
        )
        .setTimestamp();

    if (description) {
        embed.setDescription(description);
    }

    return embed;
}

// 3. Register Slash Commands on Ready (Using Guild ID for instant appearance)
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const clientId = process.env.CLIENT_ID || process.env.APP_ID;
    const token = process.env.DISCORD_TOKEN;
    const GUILD_ID = '1563759141858705439'; // Replace with your actual server ID

    if (!clientId || !token) {
        console.error('ERROR: Missing CLIENT_ID or DISCORD_TOKEN in environment variables.');
        return;
    }

    const rest = new REST({ version: '10' }).setToken(token);
    try {
        console.log('Registering slash commands...');
        
        await rest.put(
            Routes.applicationGuildCommands(clientId, GUILD_ID),
            { body: commands }
        );
        
        console.log('Slash commands registered successfully!');
    } catch (error) {
        console.error('Failed to register slash commands:', error);
    }
});

// 4. Handle Interaction Events (Slash Commands & Buttons)
client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'join') {
            const eventTitle = interaction.options.getString('event');
            const eventTime = interaction.options.getString('time');
            const eventDesc = interaction.options.getString('description') || null;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('join_event_btn')
                    .setLabel('Join Event')
                    .setStyle(ButtonStyle.Success),
                new ButtonBuilder()
                    .setCustomId('leave_event_btn')
                    .setLabel('Leave Event')
                    .setStyle(ButtonStyle.Danger)
            );

            const initialEmbed = createEventEmbed(eventTitle, eventTime, eventDesc, []);
            const responseMessage = await interaction.reply({
                embeds: [initialEmbed],
                components: [row],
                fetchReply: true
            });

            activeEvents.set(responseMessage.id, {
                title: eventTitle,
                time: eventTime,
                description: eventDesc,
                participants: []
            });
        } 
        else if (interaction.commandName === 'help') {
            await interaction.reply({
                content: '🤖 **Event Bot Help Menu**\n\n- `/join [event] [time] [description]` : Create a new interactive sign-up event post.\n- Click **Join Event** or **Leave Event** on any event post to update your attendance status!',
                ephemeral: true
            });
        }
    }

    if (interaction.isButton()) {
        const eventData = activeEvents.get(interaction.message.id);

        if (!eventData) {
            return interaction.reply({ 
                content: 'This event sign-up list is no longer active in memory.', 
                ephemeral: true 
            });
        }

        const userId = interaction.user.id;
        const userIndex = eventData.participants.findIndex(p => p.id === userId);

        if (interaction.customId === 'join_event_btn') {
            if (userIndex !== -1) {
                return interaction.reply({ content: 'You are already signed up for this event!', ephemeral: true });
            }

            eventData.participants.push({ id: userId, tag: interaction.user.tag });
            await interaction.update({ embeds: [createEventEmbed(eventData.title, eventData.time, eventData.description, eventData.participants)] });
        } 
        else if (interaction.customId === 'leave_event_btn') {
            if (userIndex === -1) {
                return interaction.reply({ content: 'You are not in the participant list!', ephemeral: true });
            }

            eventData.participants.splice(userIndex, 1);
            await interaction.update({ embeds: [createEventEmbed(eventData.title, eventData.time, eventData.description, eventData.participants)] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);