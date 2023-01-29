import https from "https";
import http from "http";

export default function request(url,params: { host?: string, path?: string, port?: number, body?: string, method?: string} = {}): Promise<{status: number, body: string}> {
    return new Promise(resolve => {
        const protos = {https,http};
        const proto = protos[url.split("://")[0] ?? "http"];
        params = {
            ...params,
            host: url.split("://")[1].split("/")[0],
            path: "/"+url.split("://")[1].split("/").slice(1).join("/")
        };
        const req = proto.request(params, res => {
            let data: any = [];
            res.on("data", chunk => data.push(chunk));
            res.on("end", () => {
                resolve({
                    status: res.statusCode,
                    body: Buffer.concat(
                        data,
                        data.reduce((acc, item) => acc + item.length, 0)
                    ).toString()
                });
            });
        });
        if (params.body)
            req.write(params.body);
        req.end();
    });
}