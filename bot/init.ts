import {existingCommands} from "./Classes/CommandsDescription";
import {getExistingCommands} from "./Classes/CommandsDescription";
import client from "./client";
import {Interaction, VoiceState} from "discord.js";
import {initSlashCommands, initSlashCommandsOnGuild, listenSlashCommands} from "./slashCommands";
import {listenInviteButtons, listenAskInviteBackButtons} from "./Classes/TextAndVocalFunctions";
import {listenCustomCommands} from "./listenCustomCommands";

export default function init(bot) {
    client.on('ready', () => {
        getExistingCommands().then(() => {
            //@ts-ignore
            existingCommands.NotifyOnReact.applyNotifyOnReactAtStarting(bot);
            //@ts-ignore
            existingCommands.Monitor.initAllEventListeners();
            //@ts-ignore
            existingCommands.ConfigTicket.initListeningAllMessages();

            initSlashCommands();

            client.on('guildCreate', initSlashCommandsOnGuild);

            client.on('interactionCreate', async (interaction: Interaction) => {

                if (interaction.isButton()) {
                    await interaction.deferReply();
                    if (await Promise.all([
                        listenInviteButtons(interaction, 'text'),
                        listenInviteButtons(interaction, 'vocal'),
                        listenAskInviteBackButtons(interaction, 'text'),
                        listenAskInviteBackButtons(interaction, 'vocal')
                    ]).then(responses => !responses.includes(true))) {
                        await interaction.editReply({content: "Bouton invalide"});
                    }
                    return;
                }

                listenSlashCommands(interaction);
            });

            client.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) => {
                //@ts-ignore
                existingCommands.Vocal.listenVoiceChannelsConnects(oldState, newState);
            })

            client.on("messageCreate", message => {
                listenCustomCommands(message);

                //@ts-ignore
                existingCommands.ConfigWelcome.listenJoinsToWelcome(message)

                //@ts-ignore
                existingCommands.Text.listenTextMessages(message);
            })
        })
    });
}
