import 'dotenv/config';
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

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// Store active events in memory (Map: messageId -> event object)
const activeEvents = new Map();

// 1. Define the /join command with a title option
const commands = [
    new SlashCommandBuilder()
        .setName('join')
        .setDescription('Create an event sign-up list')
        .addStringOption(option => 
            option.setName('event')
                .setDescription('The title/description of the event')
                .setRequired(true)
        )
];

// 2. Register slash commands when bot is ready
client.once('ready', async () => {
    console.log(`Logged in as ${client.user.tag}!`);

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
        console.log('Registering slash commands...');
        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands }
        );
        console.log('Slash commands registered successfully!');
    } catch (error) {
        console.error('Error registering commands:', error);
    }
});

// 3. Helper function to create/update the Event Embed
function createEventEmbed(title, participants) {
    const listText = participants.length > 0 
        ? participants.map((user, index) => `${index + 1}. <@${user.id}>`).join('\n')
        : '*No participants yet! Click Join below.*';

    return new EmbedBuilder()
        .setTitle(`📅 Event: ${title}`)
        .setColor(0x5865F2)
        .addFields({ name: `Participants (${participants.length})`, value: listText })
        .setTimestamp();
}

// 4. Command & Button Handler
client.on('interactionCreate', async (interaction) => {
    // Handle /join event:[title]
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'join') {
            const eventTitle = interaction.options.getString('event');

            // Build Join/Leave Buttons
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

            const initialEmbed = createEventEmbed(eventTitle, []);
            const responseMessage = await interaction.reply({
                embeds: [initialEmbed],
                components: [row],
                fetchReply: true
            });

            // Store event details
            activeEvents.set(responseMessage.id, {
                title: eventTitle,
                participants: [] // Array of { id, tag }
            });
        }
    }

    // Handle Button Clicks
    if (interaction.isButton()) {
        const eventData = activeEvents.get(interaction.message.id);

        if (!eventData) {
            return interaction.reply({ 
                content: 'This event post is no longer active.', 
                ephemeral: true 
            });
        }

        const userId = interaction.user.id;
        const userIndex = eventData.participants.findIndex(p => p.id === userId);

        if (interaction.customId === 'join_event_btn') {
            if (userIndex !== -1) {
                return interaction.reply({ content: 'You are already in the list!', ephemeral: true });
            }

            eventData.participants.push({ id: userId, tag: interaction.user.tag });
            await interaction.update({ embeds: [createEventEmbed(eventData.title, eventData.participants)] });
        } 
        else if (interaction.customId === 'leave_event_btn') {
            if (userIndex === -1) {
                return interaction.reply({ content: 'You are not in the list!', ephemeral: true });
            }

            eventData.participants.splice(userIndex, 1);
            await interaction.update({ embeds: [createEventEmbed(eventData.title, eventData.participants)] });
        }
    }
});

client.login(process.env.DISCORD_TOKEN);