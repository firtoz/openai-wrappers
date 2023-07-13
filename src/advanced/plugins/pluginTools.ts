// noinspection JSUnusedGlobalSymbols

import {ChatCompletionOptions, ChatStreamDelta, FunctionModelName} from "../../types";
import {OpenAPIV3 as OpenAPIVersion} from "openapi-types";
import {AIPluginManifest} from "chatgpt-plugin";
import axios from "axios";
import YAML from "yaml";
import _ from 'lodash';
import {ChatCompletionAdvancedParams, getChatCompletionAdvanced} from "../../chatCompletion";
import {OpenAIApi} from "openai";
import {PluginFunctionType, PluginNamespaceDefinition} from "./pluginNamespaceDefinition";
import {getJson} from "./getJson";
import {identityFunction} from "../utils/identityFunction";
import {ChatCompletionFunctions} from "openai/dist/api";
import PathsObject = OpenAPIVersion.PathsObject;

export type PluginOperationInfo = {
    path: string,
    operation: OpenAPIVersion.OperationObject,
    method: string,
};

export type PluginOperationMap = Record<string, PluginOperationInfo | undefined>;

export interface PluginInfo {
    url: string,
    manifest: AIPluginManifest,
    rebuiltPaths: PathsObject;
    parsedYaml: OpenAPIVersion.Document;
    operationInfo: PluginOperationMap;
    namespaceInfo: PluginNamespaceDefinition | null;
}

export function buildPathInfo(pluginDocument: OpenAPIVersion.Document) {
    const entries = Object.entries(pluginDocument.paths)
        .filter(([path]) => {
            return !path.startsWith('/.well-known');
        });

    const rebuiltPaths: PathsObject = {};
    const operationInfo: PluginOperationMap = {};

    for (const [path, value] of entries) {
        if (!value) {
            continue;
        }

        rebuiltPaths[path] = Object
            .fromEntries(Object.entries(value)
                .map(([method, rawEntry]) => {
                    const entry = rawEntry as OpenAPIVersion.OperationObject;

                    if (operationInfo[`${entry.operationId}`]) {
                        console.warn(`Duplicate operationId: ${entry.operationId}`);
                    }

                    operationInfo[`${entry.operationId}`] = {
                        method,
                        path,
                        operation: entry,
                    };

                    const newPathObject = {
                        operationId: entry.operationId,
                        parameters: entry.parameters,
                        requestBody: entry.requestBody,
                    };

                    return [
                        method,
                        newPathObject,
                    ]
                }));
    }

    return {
        rebuiltPaths,
        operationInfo,
    };
}


interface GetPluginInternalParams {
    openaiClient: OpenAIApi;
    url: string;
    model?: FunctionModelName;
    getProxyUrl?: (url: string) => string;
}

/**
 *     enum HttpMethods {
 *         GET = "get",
 *         PUT = "put",
 *         POST = "post",
 *         DELETE = "delete",
 *         OPTIONS = "options",
 *         HEAD = "head",
 *         PATCH = "patch",
 *         TRACE = "trace"
 *     }
 */
const httpMethods = [
    'get',
    'put',
    'post',
    'delete',
    'options',
    'head',
    'patch',
    'trace',
] as const;

const GenerateNamespaceFunction: ChatCompletionFunctions = {
    name: 'generateNamespace',
    "parameters": {
        "type": "object",
        "properties": {
            "name": {
                "type": "string",
                "description": "The name of the namespace",
            },
            "functions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "name": {
                            "type": "string",
                            "description": "The name of the function",
                            "default": "abcde",
                            "example": "dfa",
                        },
                        "description": {
                            "type": "string",
                            "description": "The description of the function",
                        },
                        "parameters": {
                            "type": "object",
                            "description": "The parameters of the function. The keys are the parameter names, and the values are the parameter types.",
                            "patternProperties": {
                                ".*": {
                                    "type": "object",
                                    "properties": {
                                        "type": {
                                            "type": "string",
                                            "description": "The type of the parameter",
                                            "enum": [
                                                "string",
                                                "number",
                                                "boolean",
                                                "object",
                                                "array",
                                                "null",
                                            ],
                                        },
                                        "description": {
                                            "type": "string",
                                            "description": "The description of the parameter",
                                        },
                                        "example": {
                                            "type": "string",
                                            "description": "The example of the parameter",
                                        },
                                        "default": {
                                            "description": "The default value of the parameter",
                                        },
                                        "enum": {
                                            "type": "array",
                                            "items": {
                                                "type": "string",
                                                "description": "The enum values of the parameter",
                                            }
                                        },
                                        "properties": {
                                            "type": "object",
                                            "additionalProperties": true,
                                            "description": "The properties of the parameter, excluding 'required'",
                                        },
                                        "required": {
                                            "type": "array",
                                            "items": {
                                                "type": "string",
                                                "description": "The required properties of the parameter",
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    "required": [
                        "name",
                        "parameters",
                    ],
                },
            },
        },
        "required": [
            "functions"
        ],
    },
    description: 'Generate a namespace definition from an OpenAPI spec'
};

function produceNamespaceGenerationMessage(
    manifest: AIPluginManifest,
    specForPrompt: Pick<OpenAPIVersion.Document, "openapi" | "paths">,
) {
    return `Using the OpenAPI spec below, create a namespace definition in this format, exclude /well-known/ai-plugin.json:

Example input for the generateNamespace function:
\`\`\`ts
{
    "name": "${manifest.name_for_model}", // the name of the namespace,
    "functions": [
        {
            "name": "[operationId]",
            "description": "[the complete summary for the operation from the spec combined with the description from the spec]",
            "parameters": {
                "type": "object",
                "properties": {
                    "[parameters[0].name]": {
                        "type"?: "[type from schema]. Can only be one of: string, number, boolean, array, object, null. Use number instead of integer or float.",
                        "description": "[parameter description]",
                        "example"?: [infer from schema or description, otherwise exclude],
                        "default"?: [infer from schema or description, otherwise exclude],
                        "enum"?: [infer from schema or description, otherwise exclude. e.g. if description mentions "only a, b, c", use ["a", "b", "c"]],
                        // REMOVE the required field, use it for the parent object instead
                    },
                    "[parameters[1].name]": {
                        // ...
                    },
                    // more properties
                },
                "required": ["[parameters[0].name]", ..."],
            },
        },
        // ... more functions ...
    ]
}
\`\`\`

Use the operation info for each operation, exclude the return types for simplicity. 

Prefer to inline the types into the parameters.

Make sure to resolve references from the components section. 

Make sure to use enums where applicable.

Include the full summary for each function and the full description of each parameter in the respective description fields, verbatim.
If a parameter description mentions a strict list of values are accepted, build an enum field for the result object. 
If a parameter description mentions an example for an input, use that in an "example" field of the result object.
 
If a parameter has "required" value set, use it for the \`required\` array of the parent object instead.
Do not include the "required" field in the parameter output.

If the examples and defaults are mentioned for a parameter, include them in the result for that parameter. 

Namespace '${manifest.name_for_model}' 
Spec: ###
${JSON.stringify(specForPrompt)}
###`;
}

export const processPlugin = async (
    {
        openaiClient,
        url,
        getProxyUrl = identityFunction,
        model = 'gpt-4-0613',
    }: GetPluginInternalParams,
): Promise<PluginInfo | undefined> => {
    try {
        const manifest = await getJson<AIPluginManifest>(getProxyUrl(url));
        if (manifest.api.type.toLowerCase() === 'openapi') {
            const apiResponse = (await axios.get(getProxyUrl(manifest.api.url)));
            let parsedYaml: OpenAPIVersion.Document;

            if (typeof apiResponse.data === 'object') {
                parsedYaml = apiResponse.data;
            } else {
                if (apiResponse.headers['content-type'] && apiResponse.headers['content-type'].startsWith('text/')) {
                    parsedYaml = YAML.parse(apiResponse.data);
                } else {
                    return undefined;
                }
            }

            const {
                rebuiltPaths,
                operationInfo,
            } = buildPathInfo(parsedYaml);

            const specForPrompt: Pick<OpenAPIVersion.Document, 'openapi' | 'paths'> = _.cloneDeep(
                _.pick(parsedYaml, ['openapi', 'paths', 'components']),
            );

            const pathEntries = Object.entries(specForPrompt.paths);
            for (const [, value] of pathEntries) {
                if (!value) {
                    continue;
                }

                // for each method in httpMethods, if it's in the path, trim it
                // the trimming should keep:
                // - parameters
                // - requestBody
                // - summary
                // - description
                // - operationId

                for (const method of httpMethods) {
                    const methodValue = value[method];
                    if (methodValue) {
                        value[method] = _.pick(methodValue, [
                            'parameters',
                            'requestBody',
                            'summary',
                            'description',
                            'operationId',
                        ]) as OpenAPIVersion.OperationObject;
                    }
                }
            }
            const namespaceGenerationMessage = produceNamespaceGenerationMessage(manifest, specForPrompt);

            const namespaceInfoPromise = new Promise<PluginNamespaceDefinition | null>(async (resolve) => {
                try {
                    const options: Partial<ChatCompletionOptions> = {
                        model,
                        functions: [
                            GenerateNamespaceFunction
                        ],
                        function_call: {
                            name: 'generateNamespace',
                        },
                    };

                    const namespacePromise = new Promise<ChatStreamDelta>(resolve => {
                        const params: ChatCompletionAdvancedParams = {
                            options,
                            messages: [{
                                role: 'user',
                                content: namespaceGenerationMessage,
                            }],
                            openai: openaiClient,
                            onProgress(delta) {
                                resolve(delta);
                            },
                            onError(error) {
                                console.error(error);
                            }
                        };

                        getChatCompletionAdvanced(params);
                    });

                    const result = await namespacePromise;

                    const namespaceData = result.choices[0].delta.function_call?.arguments;

                    let parsed: PluginNamespaceDefinition | null = null;
                    try {
                        if (!namespaceData) {
                            parsed = null;
                        } else {
                            parsed = JSON.parse(namespaceData) as PluginNamespaceDefinition;
                        }
                    } catch (e) {
                        console.error(e);
                        parsed = null;
                    }

                    resolve(parsed);
                } catch (e) {
                    console.error(e);
                    resolve(null);
                }
            });

            const namespaceInfo = await namespaceInfoPromise;

            return {
                url,
                manifest,
                parsedYaml,
                rebuiltPaths,
                operationInfo,
                namespaceInfo,
            };
        }
        return undefined;
    } catch (e) {
        console.error(e);
        return undefined;
    }
}


export const getFunctionName = (pluginInfo: PluginInfo, f: PluginFunctionType) => {
    return `${f.name}`;
};

export const getPluginInfoString = (pluginInfo: PluginInfo) => {
    return `Tool: ${pluginInfo.manifest.name_for_model}
Description: ${pluginInfo.manifest.description_for_model}
Functions: ${pluginInfo.namespaceInfo?.functions.map(func => getFunctionName(pluginInfo, func)).join(', ')}`;
}

export const getToolsSystemMessage = (pluginInfos: PluginInfo[]) => {
    const toolInfo = pluginInfos
        .map((pluginInfo) => {
            return getPluginInfoString(pluginInfo);
        })
        .join('\n\n');

    return `You have tools available for you to use. Always prefer to use the tools and functions provided. If the user requests something that is relevant to a tool function, use that tool function, especially for general knowledge based questions, even if the answer may be obvious.

If the function you require is not in the list of functions, you have to mention that you are not capable of responding to this request. Respond by declaring which function you will use and why, then use the function.

Tools: 
${toolInfo}`;
};

