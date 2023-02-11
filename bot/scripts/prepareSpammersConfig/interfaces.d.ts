import { IXPData } from "../../Models/XP/XPData";

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

interface IConfigServer {
    id: string;
    spammersIds: string[];
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
    XPConfig?: PartialBy<Omit<IXPData, 'serverId'|'enabled','save','remove'>, 'timezone'>;

    servers: IConfigServer[]|IConfigServer;
}

interface INotificationConfig {
    configModel: Model<Schema>,
    subscribeModel: Model<Schema>,
    allModels: Model<Schema>[],
    getNbListenByUser: (config: IConfig) => IConfig['vocalNbListenByUser']|IConfig['textNbListenByUser'],
    additionnalConfigParams: (config: IConfig) => {[key: string]: any}
}