import client from "./client";
import {Interaction} from "discord.js";
import {ApplicationCommandOptionType} from "discord-api-types/payloads/v9/_interactions/_applicationCommands/chatInput";

export default async function initSlashCommands() {
    console.log("initSlashCommands");


    const commands = client.application?.commands;
    console.log({commands});
    console.log(commands?.cache.map(command => command.name));
    let res
    res = await commands?.create({
        name: 'add',
        description: 'Make a ping'
    });
    console.log({ping: res});
    res = await commands?.create({
        name: 'calcul',
        description: 'calculer',
        options: [
            {
                type: ApplicationCommandOptionType.Number,
                name: 'num1',
                description: "Premier nombre",
                required: true
            },
            {
                type: ApplicationCommandOptionType.Number,
                name: 'num2',
                description: "Deuxième nombre",
                required: true
            },
            {
                type: ApplicationCommandOptionType.Number,
                name: 'truc',
                description: "machin",
                required: true
            }]
    });
    console.log({calcul: res});
    console.log("created");
    console.log(commands?.cache.map(command => command.name));

    if (true) {
        console.log("delete fucking wtf commands");
        for (const [,command] of commands?.cache??[]) {
            console.log("delete "+command.name);
            await command.delete();
        }
    }
}

export async function listenSlashCommands(interaction: Interaction) {
    if (!interaction.isCommand()) return;

    const {commandName, options} = interaction;

    switch (commandName) {
        case 'ping':
            await interaction.deferReply({
                ephemeral: true
            });
            await sleep(1000);
            await interaction.editReply({
                content: 'pong'
            });
            break;
        case 'calcul':
            await interaction.reply({
                content: options.getNumber('num1')+' + '+options.getNumber('num2')+' = '+((options.getNumber('num1')??0) + (options.getNumber('num2')??0)),
                ephemeral: true
            })
    }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve,ms));
