import {describe, expect, it, vi, beforeEach} from 'vitest';
import {Configuration, OpenAIApi} from "openai";
import path from 'path';
import fs from 'fs';
import {
    PluginInfo,
} from "../src/advanced/plugins/pluginTools";
import {ChatStreamDelta, CustomCompletionError, getChatCompletionAdvanced} from "../src";
import {ChatCompletionRequestMessageRoleEnum} from "openai/dist/api";

import {mergeChatStreamDeltas} from "../src/advanced/plugins/mergeChatStreamDeltas";
import {callOperation} from "../src/advanced/plugins/callOperation";

const axiosMockState = {
    getMock: vi.fn(),
    postMock: vi.fn(),
    useMocks: false,
};

vi.mock('axios', async () => {
    const actual = await vi.importActual<typeof import('axios')>('axios');

    return {
        ...actual,
        default: {
            ...actual.default,
            get: vi.fn(async (...args) => {
                if (axiosMockState.useMocks) {
                    return axiosMockState.getMock(...args);
                }

                const [url] = args;

                if (url.startsWith('file://')) {
                    const filePath = url.slice('file://'.length);

                    const raw = fs.readFileSync(filePath, 'utf-8');

                    if (filePath.endsWith('.json')) {
                        return {
                            data: JSON.parse(raw),
                            headers: {
                                'content-type': 'application/json',
                            },
                        };
                    } else if (filePath.endsWith('.yaml')) {
                        return {
                            data: raw,
                            headers: {
                                'content-type': 'text/plain',
                            },
                        };
                    }

                    return {
                        data: raw,
                        headers: {
                            'content-type': 'text/plain',
                        }
                    };
                }

                return actual.default.get(args[0], args[1]);
            }),
            post: vi.fn(async (...args) => {
                if (axiosMockState.useMocks) {
                    return axiosMockState.postMock(...args);
                }

                return actual.default.post(args[0], args[1], args[2]);
            }),
        }
    }
});


describe('pluginCalls', async () => {
    // mock axios

    const openai = new OpenAIApi(new Configuration({
        apiKey: process.env.OPENAI_API_KEY,
    }));

    beforeEach(() => {
        vi.clearAllMocks();
        axiosMockState.useMocks = false;
    });

    describe('using GET', () => {
        it('should be able to receive a plugin call with arguments', async () => {
            const pluginInfo: PluginInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'plugins', 'output', 'scholarly.json'), 'utf-8'));

            expect(pluginInfo).not.toBeUndefined();
            const namespaceInfo = pluginInfo.namespaceInfo;
            expect(namespaceInfo).not.toBeNull();

            if (namespaceInfo === null) {
                throw new Error('namespaceInfo is undefined');
            }

            const result: ChatStreamDelta = await new Promise<ChatStreamDelta>(async (resolve, reject) => {
                const state = {
                    resolved: false,
                };

                await getChatCompletionAdvanced({
                    messages: [
                        {
                            name: 'User',
                            role: ChatCompletionRequestMessageRoleEnum.User,
                            content: 'Show me some research paper on the intelligence of crows.',
                        }
                    ],
                    onError(error: CustomCompletionError): void {
                        console.error('error', error);

                        if (state.resolved) {
                            return;
                        }

                        state.resolved = true;
                        reject(error);
                    },
                    onProgress(result: ChatStreamDelta): void {
                        if (state.resolved) {
                            return;
                        }

                        state.resolved = true;
                        resolve(result);
                    },
                    openai,
                    options: {
                        model: 'gpt-3.5-turbo-0613',
                        temperature: 0,
                        functions: [
                            ...namespaceInfo.functions,
                        ]
                    },
                });

                if (!state.resolved) {
                    reject(new Error('Did not receive any response'));
                }
            });

            expect(result.choices).toHaveLength(1);

            const choice = result.choices[0];

            const functionCall = choice.delta.function_call!;
            expect(functionCall).not.toBeUndefined();

            const functionCallName = functionCall.name;

            expect(functionCallName).toBe('searchGet');

            if (functionCallName === undefined) {
                throw new Error('functionCallName is undefined');
            }

            const parsedArgs = JSON.parse(functionCall.arguments!) as Record<string, string>;

            expect(parsedArgs).toEqual({
                q: 'intelligence of crows',
            });

            const operation = pluginInfo.operationInfo[functionCallName];

            expect(operation).not.toBeUndefined();

            if (operation === undefined) {
                throw new Error('operation is undefined');
            }

            let server: {
                url: string
            };

            const servers = pluginInfo.parsedYaml.servers ?? [];
            if (servers.length === 0) {
                server = {
                    url: new URL(pluginInfo.url).origin,
                };
            } else {
                server = servers[0];
            }

            axiosMockState.useMocks = true;

            const mockedData = {
                papers: [
                    {
                        title: 'The intelligence of crows',
                        url: 'https://example.com',
                    },
                ],
            };

            axiosMockState.getMock.mockResolvedValueOnce({
                data: mockedData,
                headers: {
                    'content-type': 'application/json',
                }
            });

            const callResult = await callOperation({
                server,
                operation,
                args: parsedArgs,
            });

            expect(axiosMockState.getMock).toBeCalledTimes(1);
            expect(axiosMockState.getMock).toBeCalledWith('https://scholarly.maila.ai/search?q=intelligence+of+crows', undefined);

            expect(callResult).to.deep.eq(mockedData);
        }, 100_000);
        it('should be able to receive a plugin call with arguments (streaming)', async () => {
            const pluginInfo: PluginInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'plugins', 'output', 'scholarly.json'), 'utf-8'));

            expect(pluginInfo).not.toBeUndefined();
            const namespaceInfo = pluginInfo.namespaceInfo;
            expect(namespaceInfo).not.toBeNull();

            if (namespaceInfo === null) {
                throw new Error('namespaceInfo is undefined');
            }

            const result: ChatStreamDelta = await new Promise<ChatStreamDelta>(async (resolve, reject) => {
                const state: {
                    resolved: boolean,
                    delta: ChatStreamDelta | null,
                } = {
                    resolved: false,
                    delta: null,
                };

                await getChatCompletionAdvanced({
                    messages: [
                        {
                            role: ChatCompletionRequestMessageRoleEnum.System,
                            content: `Respond only casually without using any functions or tools.`
                        },
                        {
                            name: 'User',
                            role: ChatCompletionRequestMessageRoleEnum.User,
                            content: 'Hello, how are you? Please show me some research paper on the intelligence of crows.',
                        }
                    ],
                    openai,
                    options: {
                        model: 'gpt-3.5-turbo-0613',
                        temperature: 0,
                        functions: [
                            ...namespaceInfo.functions,
                        ],
                        stream: true,
                    },
                    onError(error: CustomCompletionError): void {
                        if (state.resolved) {
                            return;
                        }

                        state.resolved = true;
                        reject(error);
                    },
                    onProgress(newValue: ChatStreamDelta): void {
                        if (state.resolved) {
                            return;
                        }

                        state.delta = mergeChatStreamDeltas(state.delta, newValue);

                        const allChoicesFinished = state.delta.choices
                            .every(choice => choice.finish_reason !== null);

                        if (allChoicesFinished) {
                            state.resolved = true;
                            resolve(state.delta);
                        }
                    },
                });

                if (!state.resolved) {
                    reject(new Error('Did not receive any response'));
                }
            });

            expect(result.choices).toHaveLength(1);

            const choice = result.choices[0];

            const functionCall = choice.delta.function_call!;
            expect(functionCall).not.toBeUndefined();

            const functionCallName = functionCall.name;

            expect(functionCallName).toBe('searchGet');

            if (functionCallName === undefined) {
                throw new Error('functionCallName is undefined');
            }

            const parsedArgs = JSON.parse(functionCall.arguments!);

            expect(parsedArgs).toEqual({
                q: 'intelligence of crows',
            });

            const operation = pluginInfo.operationInfo[functionCallName];

            expect(operation).not.toBeUndefined();

            if (operation === undefined) {
                throw new Error('operation is undefined');
            }

            let server: {
                url: string
            };

            const servers = pluginInfo.parsedYaml.servers ?? [];
            if (servers.length === 0) {
                server = {
                    url: new URL(pluginInfo.url).origin,
                };
            } else {
                server = servers[0];
            }


            axiosMockState.useMocks = true;

            const mockedData = {
                papers: [
                    {
                        title: 'The intelligence of crows',
                        url: 'https://example.com',
                    },
                ],
            };

            axiosMockState.getMock.mockResolvedValueOnce({
                data: mockedData,
                headers: {
                    'content-type': 'application/json',
                }
            });

            const callResult = await callOperation({
                server,
                operation,
                args: parsedArgs,
            });

            expect(axiosMockState.getMock).toBeCalledTimes(1);
            expect(axiosMockState.getMock).toBeCalledWith('https://scholarly.maila.ai/search?q=intelligence+of+crows', undefined);

            expect(callResult).to.deep.eq(mockedData);
        }, 100_000);
    });

    describe('using POST', () => {
        it('should be able to receive a plugin call with arguments', async () => {
            const pluginInfo: PluginInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'plugins', 'output', 'weather.json'), 'utf-8'));

            expect(pluginInfo).not.toBeUndefined();
            const namespaceInfo = pluginInfo.namespaceInfo;
            expect(namespaceInfo).not.toBeNull();

            if (namespaceInfo === null) {
                throw new Error('namespaceInfo is undefined');
            }

            const result: ChatStreamDelta = await new Promise<ChatStreamDelta>(async (resolve, reject) => {
                const state = {
                    resolved: false,
                };

                await getChatCompletionAdvanced({
                    messages: [
                        {
                            name: 'User',
                            role: ChatCompletionRequestMessageRoleEnum.User,
                            content: `What's the weather like in Berlin?`,
                        }
                    ],
                    onError(error: CustomCompletionError): void {
                        console.error('error', error);

                        if (state.resolved) {
                            return;
                        }

                        state.resolved = true;
                        reject(error);
                    },
                    onProgress(result: ChatStreamDelta): void {
                        if (state.resolved) {
                            return;
                        }

                        state.resolved = true;
                        resolve(result);
                    },
                    openai,
                    options: {
                        model: 'gpt-3.5-turbo-0613',
                        temperature: 0,
                        functions: [
                            ...namespaceInfo.functions,
                        ],
                    },
                });

                if (!state.resolved) {
                    reject(new Error('Did not receive any response'));
                }
            });

            expect(result.choices).toHaveLength(1);

            const choice = result.choices[0];

            const functionCall = choice.delta.function_call!;
            expect(functionCall).not.toBeUndefined();

            const functionCallName = functionCall.name;

            expect(functionCallName).toBe('handleWeatherQuestion');

            if (functionCallName === undefined) {
                throw new Error('functionCallName is undefined');
            }

            const parsedArgs = JSON.parse(functionCall.arguments!) as Record<string, string>;

            expect(parsedArgs).toEqual({
                question: `What's the weather like in Berlin?`,
            });

            const operation = pluginInfo.operationInfo[functionCallName];

            expect(operation).not.toBeUndefined();

            if (operation === undefined) {
                throw new Error('operation is undefined');
            }

            let server: {
                url: string
            };

            const servers = pluginInfo.parsedYaml.servers ?? [];
            if (servers.length === 0) {
                server = {
                    url: new URL(pluginInfo.url).origin,
                };
            } else {
                server = servers[0];
            }

            axiosMockState.useMocks = true;

            const mockedData = {
                papers: [
                    {
                        title: 'The intelligence of crows',
                        url: 'https://example.com',
                    },
                ],
            };

            axiosMockState.postMock.mockResolvedValueOnce({
                data: mockedData,
                headers: {
                    'content-type': 'application/json',
                }
            });

            const callResult = await callOperation({
                server,
                operation,
                args: parsedArgs,
            });

            expect(axiosMockState.postMock).toBeCalledTimes(1);
            expect(axiosMockState.postMock).toBeCalledWith("https://api.tomorrow.io/v4/chat", {
                "question": "What's the weather like in Berlin?",
            }, undefined);

            expect(callResult).to.deep.eq(mockedData);
        }, 100_000);

        it('should be able to receive a plugin call with arguments (streaming)', async () => {
            const pluginInfo: PluginInfo = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'plugins', 'output', 'weather.json'), 'utf-8'));

            expect(pluginInfo).not.toBeUndefined();
            const namespaceInfo = pluginInfo.namespaceInfo;
            expect(namespaceInfo).not.toBeNull();

            if (namespaceInfo === null) {
                throw new Error('namespaceInfo is undefined');
            }

            const result: ChatStreamDelta = await new Promise<ChatStreamDelta>(async (resolve, reject) => {
                const state: {
                    resolved: boolean,
                    delta: ChatStreamDelta | null,
                } = {
                    resolved: false,
                    delta: null,
                };

                await getChatCompletionAdvanced({
                    messages: [
                        {
                            name: 'User',
                            role: ChatCompletionRequestMessageRoleEnum.User,
                            content: `What's the weather like in Berlin?`,
                        }
                    ],
                    openai,
                    options: {
                        model: 'gpt-3.5-turbo-0613',
                        temperature: 0,
                        functions: [
                            ...namespaceInfo.functions,
                        ],
                        stream: true,
                    },
                    onError(error: CustomCompletionError): void {
                        if (state.resolved) {
                            return;
                        }

                        state.resolved = true;
                        reject(error);
                    },
                    onProgress(newValue: ChatStreamDelta): void {
                        if (state.resolved) {
                            return;
                        }

                        state.delta = mergeChatStreamDeltas(state.delta, newValue);

                        const allChoicesFinished = state.delta.choices
                            .every(choice => choice.finish_reason !== null);

                        if (allChoicesFinished) {
                            state.resolved = true;
                            resolve(state.delta);
                        }
                    },
                });

                if (!state.resolved) {
                    reject(new Error('Did not receive any response'));
                }
            });

            expect(result.choices).toHaveLength(1);

            const choice = result.choices[0];

            const functionCall = choice.delta.function_call!;
            expect(functionCall).not.toBeUndefined();

            const functionCallName = functionCall.name;

            expect(functionCallName).toBe('handleWeatherQuestion');

            if (functionCallName === undefined) {
                throw new Error('functionCallName is undefined');
            }

            const parsedArgs = JSON.parse(functionCall.arguments!) as Record<string, string>;

            expect(parsedArgs).toEqual({
                question: `What's the weather like in Berlin?`,
            });

            const operation = pluginInfo.operationInfo[functionCallName];

            expect(operation).not.toBeUndefined();

            if (operation === undefined) {
                throw new Error('operation is undefined');
            }

            let server: {
                url: string
            };

            const servers = pluginInfo.parsedYaml.servers ?? [];
            if (servers.length === 0) {
                server = {
                    url: new URL(pluginInfo.url).origin,
                };
            } else {
                server = servers[0];
            }

            axiosMockState.useMocks = true;

            const mockedData = {
                papers: [
                    {
                        title: 'The intelligence of crows',
                        url: 'https://example.com',
                    },
                ],
            };

            axiosMockState.postMock.mockResolvedValueOnce({
                data: mockedData,
                headers: {
                    'content-type': 'application/json',
                }
            });

            const callResult = await callOperation({
                server,
                operation,
                args: parsedArgs,
            });

            expect(axiosMockState.postMock).toBeCalledTimes(1);
            expect(axiosMockState.postMock).toBeCalledWith("https://api.tomorrow.io/v4/chat", {
                "question": "What's the weather like in Berlin?",
            }, undefined);

            expect(callResult).to.deep.eq(mockedData);
        }, 100_000);
    });
})
