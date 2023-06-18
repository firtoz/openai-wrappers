import {PluginOperationInfo} from "./pluginTools";
import {OpenAPIV3 as OpenAPIVersion} from "openapi-types";
import axios, {AxiosRequestConfig} from "axios";

export type CallOperationParams = {
    server: OpenAPIVersion.ServerObject;
    operation: PluginOperationInfo;
    args: object;
    config?: Omit<AxiosRequestConfig, 'data'>;
};

export const callOperation = async (
    {
        server,
        operation,
        args,
        config,
    }: CallOperationParams,
) => {
    const url = new URL(operation.path, server.url);

    switch (operation.method) {
        case 'get':
        case 'options':
        case 'head': {
            const params = new URLSearchParams(args as Record<string, string>);

            params.forEach((value, key) => {
                url.searchParams.append(key, value);
            });

            const response = await axios.get(url.toString(), config);

            return response.data;
        }
        case 'post':
        case 'put':
        case 'delete':
        case 'patch': {
            const response = await axios.post(url.toString(), args, config);

            return response.data;
        }
        default: {
            throw new Error(`Unsupported method ${operation.method}`);
        }
    }
}
