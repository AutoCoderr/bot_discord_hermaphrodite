import Command from "../Classes/Command";
import XPData, {IXPData} from "../Models/XP/XPData";

export default class AbstractXP<IArgs> extends Command<IArgs> {
    static abstract = true;

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    XPServerConfig: null|IXPData = null;

    async getXPServerConfig(): Promise<null|IXPData> {
        if (this.guild === null)
            return null;

        if (this.XPServerConfig === null) {
            this.XPServerConfig = await XPData.findOne({
                serverId: this.guild.id
            })
        }

        return this.XPServerConfig;
    }
}