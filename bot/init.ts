import {existingCommands} from "./Classes/CommandsDescription";
import {getExistingCommands} from "./Classes/CommandsDescription";
import client from "./client";
import {Interaction, VoiceState} from "discord.js";

export default function init(bot) {
    setTimeout(async () => {
        getExistingCommands().then(() => {
            //@ts-ignore
            existingCommands.NotifyOnReact.applyNotifyOnReactAtStarting(bot);
            //@ts-ignore
            existingCommands.Monitor.initAllEventListeners();
            //@ts-ignore
            existingCommands.ConfigTicket.initListeningAllMessages();

            client.on('interactionCreate', (interaction: Interaction) => {
                //@ts-ignore
                existingCommands.Vocal.listenInviteButtons(interaction);
            });

            client.on('voiceStateUpdate', (oldState: VoiceState, newState: VoiceState) => {
                //@ts-ignore
                existingCommands.Vocal.listenVoiceChannelsConnects(oldState, newState);
            })
        })
    }, 5000);
}
