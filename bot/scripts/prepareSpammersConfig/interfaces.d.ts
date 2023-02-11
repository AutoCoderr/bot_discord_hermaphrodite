import { Guild } from "discord.js";
import { ILevelTip, IXPData } from "../../Models/XP/XPData";

type RequiredBy<M, K> = Omit<M, K> & Required<Pick<M,K>>

type ISpecifiedXPConfig = RequiredBy<Partial<Omit<IXPData, 'serverId'|'enabled'|'save'|'remove'>>, 'activeRoleId'>;

type ISpecifiedLevelTip = Omit<ILevelTip, 'userApproves', 'userUnapproves'>

interface IConfigServer {
    id: string;
    spammersIds: string[];
    XPConfig?: ISpecifiedXPConfig;
}

interface IConfig {
    vocal?: boolean;
    vocalDefaultLimit?: number;
    vocalNbListenByUser?: number|[number,number];
    vocalDelay?: number;

    text?: boolean;
    textDefaultLimit?: number;
    textNbListenByUser?: number|[number,number];

    XP?: boolean;
    XPConfig?: Omit<ISpecifiedXPConfig, 'tipsByLevel'> & {tipsByLevel?: ISpecifiedLevelTip[]};

    servers: IConfigServer[]|IConfigServer;
}

interface INotificationConfig {
    configModel: Model<Schema>,
    subscribeModel: Model<Schema>,
    allModels: Model<Schema>[],
    getNbListenByUser: (config: IConfig) => IConfig['vocalNbListenByUser']|IConfig['textNbListenByUser'],
    additionnalConfigParams: (config: IConfig) => {[key: string]: any}
}