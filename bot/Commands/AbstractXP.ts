import Command from "../Classes/Command";
import XPData, {IXPData} from "../Models/XP/XPData";
import XPUserData, {IXPUserData} from "../Models/XP/XPUserData";
import {Guild} from "discord.js";

export default class AbstractXP<IArgs> extends Command<IArgs> {
    static abstract = true;

    static slashCommandIdByGuild: {[guildId: string]: string} = {};

    XPServerConfig: null|IXPData = null;
    XPUserConfig: IXPUserData|null = null;

    async getXPServerConfig(search = {}): Promise<null|IXPData> {
        if (this.guild === null)
            return null;

        if (this.XPServerConfig === null) {
            this.XPServerConfig = await XPData.findOne({
                serverId: this.guild.id,
                ...search
            })
        }

        return this.XPServerConfig;
    }

    async getXPUserConfig(member = this.member): Promise<null|IXPUserData> {
        if (this.XPUserConfig === null || this.XPUserConfig.userId !== member.id)
            this.XPUserConfig = await XPUserData.findOne({
                serverId: (<Guild>this.guild).id,
                userId: member.id
            })

        return this.XPUserConfig;
    }
}