import config from "../config";
import { NotifyOnReact } from "../Commands/NotifyOnReact";
import { Perm } from "../Commands/Perm";
import { HistoryCmd } from "../Commands/HistoryCmd";
import { HistoryExec } from "../Commands/HistoryExec";
import { HelloWorld } from "../Commands/HelloWorld";
import { Help } from "../Commands/Help";

export const existingCommands = {
    notifyOnReact : {
        msg: "Pour envoyer un message sur un channel indiqué, quand une réaction à été detectée sur un autre message\n"+config.command_prefix+"notifyOnReact help",
        commandClass: NotifyOnReact,
        display: true
    },
    perm: {
        msg: "Pour configurer les permissions\n"+config.command_prefix+"perm help",
        commandClass: Perm,
        display: true
    },
    history: {
        msg: "Pour accéder à l'historique des commandes\n"+config.command_prefix+"history help",
        commandClass: HistoryCmd,
        display: true
    },
    historyExec: {
        msg: "Pour executer des commandes de l'historique\n"+config.command_prefix+"historyExec help",
        commandClass: HistoryExec,
        display: true
    },
    hello: {
        commandClass: HelloWorld,
        display: false
    },
    help: {
        commandClass: Help,
        display: false
    }
};