import {existingCommands} from "./Classes/CommandsDescription";
import {getExistingCommands} from "./Classes/CommandsDescription";
import client from "./client";
import {Interaction, VoiceState} from "discord.js";
import {initSlashCommands, listenSlashCommands} from "./slashCommands";

export default function init(bot) {
    setTimeout(async () => {
        getExistingCommands().then(() => {
            //@ts-ignore
            existingCommands.NotifyOnReact.applyNotifyOnReactAtStarting(bot);
            //@ts-ignore
            existingCommands.Monitor.initAllEventListeners();
            //@ts-ignore
            existingCommands.ConfigTicket.initListeningAllMessages();

            initSlashCommands()

            client.on('interactionCreate', async (interaction: Interaction) => {

                if (interaction.isButton()) {
                    await interaction.deferReply();
                    if (//@ts-ignore
                        !(await existingCommands.Vocal.listenInviteButtons(interaction)) &&//@ts-ignore
                        !(await existingCommands.Vocal.listenAskInviteBackButtons(interaction))
                    ) {
                        await interaction.editReply({content: "Bouton invalide"});
                    }
                }

                listenSlashCommands(interaction);
            });

            client.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) => {
                //@ts-ignore
                existingCommands.Vocal.listenVoiceChannelsConnects(oldState, newState);
            })
        })
    }, 5000);
}
