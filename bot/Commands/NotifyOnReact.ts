import config from "../config";
import * as Discord from "discord.js";
import Command from "../Classes/Command";

interface iNotifyOnReact extends Document {
    listen: Array<string>;
    message: string;
    writeChannel: string;
}

export default class NotifyOnReact extends Command {

    static match(message) {
        return message.content.startsWith(config.command_prefix+"notifyOnReact");
    }

    static async action(message, bot) { // notifyOnReact --listen #channel/messageId --message '$user$ a réagit à ce message' :yoyo: --writeChannel #channelB
        const args: iNotifyOnReact = this.parseCommand(message);
        if (!args) return;
        console.log(args);
        let errors: Array<Object> = [];

        let channelToListen;
        let messageToListen;
        let messageToWrite;
        let channelToWrite;
        let emoteToReact;


        if (typeof(args.listen) != "object") {
            errors.push({name: "--listen missing", value: "--listen missing in your command"});
        } else if (!(args.listen instanceof Array) || args.listen.length != 2) {
            errors.push({name: "--listen incorrect", value: "--listen must be in '#channel/idDuMessage :emote:' format"})
        } else if (args.listen[0].split("/").length != 2) {
            errors.push({name: "--listen incorrect", value: "--listen must be in '#channel/idDuMessage :emote' format"})
        } else {
            emoteToReact = args.listen[1];
            // @ts-ignore
            let channelId = args.listen[0].split("/")[0].replaceAll(" ","");
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
                    let messageId = args.listen[0].split("/")[1].replaceAll(" ","");
                    try {
                        messageToListen = await channelToListen.messages.fetch(messageId);
                    } catch(e) {
                        //errors.push([{name: "Message to listen not found", value: "Specified message to listen does not exists"}]);
                    }
                    if (messageToListen == undefined) {
                        errors.push([{name: "Message to listen not found", value: "Specified message to listen does not exists"}]);
                    }
                }

            }
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
            this.sendErrors(message,errors);
            return;
        }
        console.log("channelToListen => "+channelToListen.name);
        console.log("messageToListen => "+messageToListen.content);
        console.log("messageToWrite => "+messageToWrite);
        console.log("channelToWrite => "+channelToWrite.name);
        console.log("emoteToReact => "+emoteToReact);

        message.channel.send("Get all datas successfull !");
    }

    static awaitReact(message) {
        message.awaitReactions(() => true, { max: 1, time: 60000, errors: ['time'] })
            .then(collected => {
                console.log("detect react");
                message.reply("Coucou");
                this.awaitReact(message);
            })
            .catch(collected => {
                message.reply('you reacted with neither a thumbs up, nor a thumbs down.');
            });
    }
}