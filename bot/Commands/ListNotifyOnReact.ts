import config from "../config";
import { extractChannelId } from "../Classes/OtherFunctions";
import { existingCommands } from "../Classes/CommandsDescription";
import Command from "../Classes/Command";
import Discord from "discord.js";

export class ListNotifyOnReact extends Command {
    static commandName = "listNotifyOnReact";

    static async action(message,bot) {
        const args = this.parseCommand(message);
        if (!args) return false;

        if (typeof(args[0]) != "undefined" && args[0] == "help") {
            this.displayHelp(message);
            return true;
        }

        let channelId = null;
        let channel;

        // Vérifie la validité des arguments passés à la commande

        if (typeof(args.channel) != "undefined" && typeof(args.ch) != "undefined") {
            this.sendErrors(message,{
                name: "--channel or -ch",
                value: "--channel or -ch but not the both"
            });
            return false;
        }
        if (typeof(args.channel) != "undefined" || typeof(args.ch) != "undefined") {
            channelId = extractChannelId(typeof(args.channel) != "undefined" ? args.channel : args.ch);
            if (!channelId) {
                this.sendErrors(message,{
                    name: "Channel invalide",
                    value: "Mention de channel indiqué invalide"
                });
                return false;
            }
            channel = message.guild.channels.cache.get(channelId);
            if (channel == undefined) {
                this.sendErrors(message,{
                    name: "Channel inexistant",
                    value: "Mention de channel indiqué inexistant"
                });
                return false;
            }
        }

        let messageId = null;
        let contentMessage;
        if (typeof(args.message) != "undefined" && typeof(args.m) != "undefined") {
            this.sendErrors(message,{
                name: "--message or -m",
                value: "--message or -m but not the both"
            });
            return false;
        }
        if (typeof(args.message) != "undefined" || typeof(args.m) != "undefined") {
            if (channelId == null) {
                this.sendErrors(message,{
                    name: "Spécifiez un channel",
                    value: "Vous devez spécifier un channel, avant de spécifier un message"
                });
                return false;
            }
            let messageListened
            messageId = typeof(args.message) != "undefined" ? args.message : args.m;
            try {
                messageListened = await channel.messages.fetch(messageId);
            } catch(e) {
            }
            contentMessage = messageListened != undefined ?
                messageListened.content.substring(0, Math.min(20,messageListened.content.length)) + "..."
                : messageId;
        }



        // Affiche dans un Embed, l'ensemble des écoutes de réactions qu'il y a.

        let Embed = new Discord.MessageEmbed()
            .setColor('#0099ff')
            .setTitle('Listes des écoutes de réactions :')
            .setDescription("Ceci est la liste dess écoutes de réactions :")
            .setTimestamp();

        let listenings = existingCommands.notifyOnReact.commandClass.listenings[message.guild.id];

        if (typeof(listenings) == "undefined") {
            Embed.addFields({
                name: "Aucune réaction",
                value: "Il n'y a aucune réaction sur ce serveur"
            });
        } else if (channelId != null) {
            if (typeof(listenings[channelId]) != "undefined") {
                if (messageId != null) {
                    let nbListeneds = 0;
                    if (typeof(listenings[channelId][messageId]) != "undefined") { // Si un channel et un message ont été spécifiés, regarde dans le message
                        // @ts-ignore
                        for (let emote in listenings[channelId][messageId]) {
                            if (listenings[channelId][messageId][emote]) {
                                Embed.addFields({
                                    name: "Sur '#" + channel.name + "' (" + contentMessage + ") :" + emote + ":",
                                    value: "Il y a une écoute de réaction sur ce message"
                                });
                                nbListeneds += 1;
                            }
                        }
                    }
                    if (nbListeneds == 0) {
                        Embed.addFields({
                            name: "Aucune réaction",
                            value: "Il n'y a aucune réaction sur ce message"
                        });
                    }
                } else { // Si un channel a été spécififié, mais pas de message, regarde tout les messages de ce channel
                    let nbListeneds = 0; // @ts-ignore
                    for (let messageId in listenings[channelId]) {
                        let messageListened;
                        try {
                            messageListened = await channel.messages.fetch(messageId);
                        } catch(e) {
                        }
                        const contentMessage = messageListened != undefined ?
                            messageListened.content.substring(0, Math.min(20,messageListened.content.length)) + "..."
                            : messageId; // @ts-ignore
                        for (let emote in listenings[channelId][messageId]) {
                            if (listenings[channelId][messageId][emote]) {
                                nbListeneds += 1;
                                Embed.addFields({
                                    name: "Sur '#" + channel.name + "' (" + contentMessage + ") :" + emote + ":",
                                    value: "Il y a une écoute de réaction sur ce message"
                                });
                            }
                        }
                    }
                    if (nbListeneds == 0) {
                        Embed.addFields({
                            name: "Aucune réaction",
                            value: "Il n'y a aucune réaction sur ce channel"
                        });
                    }

                }
            } else {
                Embed.addFields({
                   name: "Aucune réaction",
                   value: "Il n'y a aucune réaction sur ce channel"
                });
            }
        } else { // Si rien n'a été spécifié en argument, regarde sur tout les messaqes de tout les channels
            let nbListeneds = 0;
            for (let channelId in listenings) {
                let channel = message.guild.channels.cache.get(channelId);
                for (let messageId in listenings[channelId]) {
                    let messageListened;
                    try {
                        messageListened = await channel.messages.fetch(messageId);
                    } catch (e) {
                    }
                    const contentMessage = messageListened != undefined ?
                        messageListened.content.substring(0, Math.min(20,messageListened.content.length)) + "..."
                        : messageId;
                    for (let emote in listenings[channelId][messageId]) {
                        if (listenings[channelId][messageId][emote]) {
                            nbListeneds += 1;
                            Embed.addFields({
                                name: "Sur '#" + channel.name + "' (" + contentMessage + ") :" + emote + ":",
                                value: "Il y a une écoute de réaction sur ce message"
                            });
                        }
                    }
                }
            }
            if (nbListeneds == 0) {
                Embed.addFields({
                    name: "Aucune réaction",
                    value: "Il n'y a aucune réaction sur ce channel"
                });
            }
        }

        message.channel.send(Embed);
        return true;
    }

    static help(Embed) {
        Embed.addFields({
            name: "Arguments :",
            value: "--channel ou -ch, Spécifier le channel sur lequel lister les écoutes de réactions \n"+
                "--message ou -m, Spécifier l'id du message sur lequel afficher les réactions (nécessite le champs --channel pour savoir où est le message)"
        })
            .addFields({
                name: "Exemples :",
                value: config.command_prefix+this.commandName+" -channel #leChannel\n"+
                    config.command_prefix+this.commandName+" -channel #leChannel -m idDuMessage\n"
            });
    }
}