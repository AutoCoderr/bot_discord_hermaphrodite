import config from "../config";
import { NotifyOnReact } from "../Commands/NotifyOnReact";
import { ListNotifyOnReact } from "../Commands/ListNotifyOnReact";
import { CancelNotifyOnReact } from "../Commands/CancelNotifyOnReact";
import { ConfigWelcome } from "../Commands/ConfigWelcome";
import { Perm } from "../Commands/Perm";
import { HistoryCmd } from "../Commands/HistoryCmd";
import { HistoryExec } from "../Commands/HistoryExec";
import { ConfigTicket } from "../Commands/ConfigTicket";
import { CommunicateTicketClientSide } from "../Commands/CommunicateTicketClientSide";
import { Help } from "../Commands/Help";
import {CommunicateTicketModeratorSide} from "../Commands/CommunicateTicketModeratorSide";

export const existingCommands = {
    notifyOnReact : {
        msg: "Pour envoyer un message sur un channel indiqué, quand une réaction à été detectée sur un autre message\n"+config.command_prefix+NotifyOnReact.staticCommandName+" help",
        commandClass: NotifyOnReact,
        display: true
    },
    listNotifyOnReact : {
        msg: "Pour lister les messages, sur lesquels il y a une écoute de réaction\n"+config.command_prefix+ListNotifyOnReact.staticCommandName+" help",
        commandClass: ListNotifyOnReact,
        display: true
    },
    cancelNotifyOnReact : {
        msg: "Pour désactiver l'écoute d'une réaction sur un ou plusieurs messages\n"+config.command_prefix+CancelNotifyOnReact.staticCommandName+" help",
        commandClass: CancelNotifyOnReact,
        display: true
    },
    configWelcome: {
        msg: "Pour activer, désactiver, ou définir le message privé à envoyer automatiquement aux nouveaux arrivants\n"+config.command_prefix+ConfigWelcome.staticCommandName+" help",
        commandClass: ConfigWelcome,
        display: true
    },
    perm: {
        msg: "Pour configurer les permissions\n"+config.command_prefix+Perm.staticCommandName+" help",
        commandClass: Perm,
        display: true
    },
    history: {
        msg: "Pour accéder à l'historique des commandes\n"+config.command_prefix+HistoryCmd.staticCommandName+" help",
        commandClass: HistoryCmd,
        display: true
    },
    historyExec: {
        msg: "Pour executer des commandes de l'historique\n"+config.command_prefix+HistoryExec.staticCommandName+" help",
        commandClass: HistoryExec,
        display: true
    },
    configTicket: {
        msg: "Pour définir la catégorie pour les channels des tickets, activer, ou désactiver les ticket\n"+config.command_prefix+ConfigTicket.staticCommandName+" help",
        commandClass: ConfigTicket,
        display: true
    },
    communicateTicketClientSide: {
        commandClass: CommunicateTicketClientSide,
        display: false
    },
    communicateTicketModeratorSide: {
        commandClass: CommunicateTicketModeratorSide,
        display: false
    },
    help: {
        commandClass: Help,
        display: false
    }
};