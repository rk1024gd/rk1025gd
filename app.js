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

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Discord Event Bot is active and running!');
});

app.listen(PORT, () => {
    console.log(`Keep-alive web server listening on port ${PORT}`);
});

const client = new Client({ intents: [GatewayIntentBits.Guilds] });
const activeEvents = new Map();

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

client.on('interactionCreate', async (interaction) => {
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === 'join') {
            const eventTitle = interaction.options.getString('event');

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

            activeEvents.set(responseMessage.id, {
                title: eventTitle,
                participants: []
            });
        }
    }

    if (interaction.isButton()) {
        const eventData = activeEvents.get(interaction.message.id);

        if (!eventData) {
            return interaction.reply({ 
                content: 'This event post is no longer active.', 
                ephemeral: true 
            });