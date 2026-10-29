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

// 1. Setup a lightweight Express server for Render's web service health checks
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
    res.send('Discord Event Bot is active and running!');
});

app.listen(PORT, () => {
    console.log(`Keep-alive web server listening on port ${PORT}`);
});

// 2. Setup Discord Gateway Client
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

client.on('interaction