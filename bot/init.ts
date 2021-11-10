import {existingCommands} from "./Classes/CommandsDescription";
import {getExistingCommands} from "./Classes/CommandsDescription";
import client from "./client";
import {Interaction, VoiceState} from "discord.js";
import initSlashCommands, {listenSlashCommands} from "./initSlashCommands";

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

            client.on('interactionCreate', (interaction: Interaction) => {
                //@ts-ignore
                existingCommands.Vocal.listenInviteButtons(interaction);

                listenSlashCommands(interaction);
            });

            client.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) => {
                //@ts-ignore
                existingCommands.Vocal.listenVoiceChannelsConnects(oldState, newState);
            })
        })
    }, 5000);
}
