import { IXPData } from "../../Models/XP/XPData";

type PartialBy<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>

interface IConfigServer {
    id: string;
    spammersIds: string[];
}

interface IConfig {
    vocal?: boolean;
    vocalNbListenByUser?: number|[number,number];
    text?: boolean;
    XP?: boolean;
    textNbListenByUser?: number|[number,number];
    XPConfig?: PartialBy<Omit<IXPData, 'serverId'|'enabled','save','remove'>, 'timezone'>;
    servers: IConfigServer[]|IConfigServer;
}