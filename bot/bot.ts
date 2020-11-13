import Emote, { IEmote } from "./Models/Emote";

import config from "./config";

import * as Discord from "discord.js";

import HelloWorld from "./Commands/HelloWorld";



const bot = new Discord.Client();

const commands = [ HelloWorld ];

// check all commands
bot.on('message', message => {
    for (let command of commands) {
        if (command.match(message)) {
            command.action(message, bot);
        }
    }
});

(async () => {
    console.log("TEST AJOUT EMOTE DANS MONGODB");
    let emotes = await Emote.find({});
    if (emotes.length == 0) { // Créer une emote, s'il n'en trouve pas
        const date = new Date();
        // Ajoute une emote de test pour les stats dans la bdd
        const emote: IEmote = {
            userName: "Toto",
            emoteName: ":ahego:",
            dateTime: date.getFullYear() + "-" + (date.getMonth() + 1) + "-" + date.getDate() + " " + date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds()
        }

        await Emote.create(emote);
        emotes = await Emote.find({});
    }
    console.log("Les emotes");
    console.log(emotes);
})();

bot.login(config.token);