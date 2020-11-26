import config from "../config";
import Command from "../Classes/Command";
import { extractEmoteName } from "../Classes/OtherFunctions";

interface iNotifyOnReact extends Document {
    listen: string;
    message: string;
    writeChannel: string;
    e: string; // emote
}

export default class NotifyOnReact extends Command {

    static match(message) {
        return message.content.split(" ")[0] == config.command_prefix+"notifyOnReact";
    }

    static async action(message, bot) { // notifyOnReact --listen #channel/messageId --message '$user$ a réagit à ce message' -e :yoyo: --writeChannel #channelB
        const args: iNotifyOnReact = this.parseCommand(message);
        if (!args) return;
        let errors: Array<Object> = [];

        let channelToListen;
        let messageToListen;
        let messageToWrite;
        let channelToWrite;
        let emoteToReact;


        if (typeof(args.listen) == "undefined") {
            errors.push({name: "--listen missing", value: "--listen missing in your command"});
        } else if (args.listen.split("/").length != 2) {
            errors.push({name: "--listen incorrect", value: "--listen must be in '#channel/idDuMessage' format"})
        } else {
            // @ts-ignore
            let channelId = args.listen.split("/")[0].replaceAll(" ","");
            channelId = channelId.split("<#")[1];
            if (channelId == undefined) {
                errors.push([{name: "Channel to listen not found", value: "Specified channel to listen does not exists"}]);
            } else {
                channelId = channelId.substring(0,channelId.length-1);
                channelToListen = message.guild.channels.cache.get(channelId);

                if (channelToListen == undefined) {
                    errors.push([{name: "Channel to listen not found", value: "Specified channel to listen does not exists"}]);
                } else {
                    // @ts-ignore
                    let messageId = args.listen.split("/")[1].replaceAll(" ","");
                    try {
                        messageToListen = await channelToListen.messages.fetch(messageId);
                    } catch(e) {
                    }
                    if (messageToListen == undefined) {
                        errors.push([{name: "Message to listen not found", value: "Specified message to listen does not exists"}]);
                    }
                }

            }
        }

        if (typeof(args.e) == "undefined") { // check emote
            errors.push([{name: "-e missing", value: "mention -e of emote missing"}]);
        } else {
            emoteToReact = args.e;
        }

        if (typeof(args.message) == "undefined") {
            errors.push({name: "--message missing", value: "--message missing in your command"});
        } else {
            messageToWrite = args.message;
        }

        if (typeof(args.writeChannel) == "undefined") {
            errors.push({name: "--writeChannel missing", value: "--writeChannel missing in your command"});
        } else {
            let channelId = args.writeChannel.split("<#")[1];
            if (channelId == undefined) {
                errors.push([{name: "Channel to write not found", value: "Specified channel to write does not exists"}]);
            } else {
                channelId = channelId.substring(0, channelId.length - 1);
                channelToWrite = message.guild.channels.cache.get(channelId);
                if (channelToWrite == undefined) {
                    errors.push([{name: "Channel not found", value: "Specified channel does not exists"}]);
                }
            }
        }

        if (errors.length > 0) {
            this.sendErrors(message,errors,this.help);
            return;
        }

        this.reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, extractEmoteName(emoteToReact));

        message.channel.send("Command sucessfully executed, all reactions to this message will be notified");
    }

    static async reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteName) {
        let userWhoReact;
        const filter = (reaction, user) => {
            userWhoReact = user;
            return reaction.emoji.name == emoteName;
        };
        messageToListen.awaitReactions(filter, { max: 1 })
            .then(collected => {
                const variables: Object = {
                    user: "<@"+userWhoReact.id+">"
                }
                let toWrite = messageToWrite;
                for (let key in variables) {
                    const regex = new RegExp("\\$( )*"+key+"( )*\\$");
                    toWrite = toWrite.replace(regex, variables[key]);
                }
                channelToWrite.send(toWrite);

                this.reactingAndNotifyOnMessage(messageToListen, channelToWrite, messageToWrite, emoteName);
            })
            .catch(collected => {
                console.log("Catch event in reactingAndNotifyOnMessage() function");
            });
    }

    static help(Embed) {
        Embed.
        addFields({
            name: "Arguments :",
            value: "--listen, Indique le channel et le message à écouter, séparés d'un '/'\n"+
                "-e, Indique l'emote à laquelle réagir\n"+
                "--message, Le message à afficher dés qu'un réaction sur le message est detectée\n"+
                "--writeChannel, le channel sur lequel écrire le message à chaque réaction"
        })
            .addFields({
            name: "Exemple :",
            value: config.command_prefix+"notifyOnReact --listen #ChannelAEcouter/IdDuMessageAEcouter -e :emoteAEcouter: --message '$user$ a réagit à ce message' --writeChannel #channelSurLequelEcrire"
        });
    }
}