import {it, expect, describe, vi} from 'vitest';
import {Configuration, OpenAIApi} from "openai";
import {ChatStreamDelta, CompletionErrorType, getChatCompletionAdvanced} from "../src";
import {allChoicesFinished, mergeChatStreamDeltas} from "../src/advanced/plugins/mergeChatStreamDeltas";

const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));

describe('getChatCompletionAdvanced', () => {
    describe('with function calls', () => {
        const weatherFunction = {
            "name": "get_current_weather",
            "description": "Get the current weather in a given location",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "The city and state, e.g. San Francisco, CA",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"]
                    },
                },
                "required": ["location"],
            },
        };

        it('should work', async () => {
            const errorReceived = vi.fn();
            const progressReceived = vi.fn();
            const promise = getChatCompletionAdvanced({
                openai,
                options: {
                    temperature: 0,
                    model: 'gpt-3.5-turbo-0613',
                    stream: false,
                    functions: [
                        weatherFunction,
                    ],
                },
                messages: [
                    {
                        "role": "user",
                        "content": "What's the weather like in London?",
                    },
                ],
                onError: errorReceived,
                onProgress: progressReceived,
            });

            await promise;

            expect(errorReceived).not.toBeCalled();
            expect(progressReceived).toBeCalled();
            expect(progressReceived.mock.calls).toHaveLength(1);

            expect(progressReceived.mock.calls[0][0]).toMatchObject({
                "created": expect.any(Number),
                "model": "gpt-3.5-turbo-0613",
                "object": "chat.completion",
                "id": expect.stringMatching(/^chatcmpl-/),
                "choices": [
                    {
                        "delta": {
                            "role": "assistant",
                            "content": null,
                            "function_call": {
                                "name": weatherFunction.name,
                                "arguments": "{\n  \"location\": \"London\"\n}"
                            }
                        },
                        "index": 0,
                        "finish_reason": "function_call"
                    }
                ],
                "usage": {
                    "prompt_tokens": 82,
                    "completion_tokens": 16,
                    "total_tokens": 98,
                },
            });
        }, 10000);
        it('should allow streaming', async () => {
            const errorReceived = vi.fn();
            const progressReceived = vi.fn();

            const state = {
                delta: null as ChatStreamDelta | null,
            }

            const promise = getChatCompletionAdvanced({
                openai,
                options: {
                    temperature: 0,
                    model: 'gpt-3.5-turbo-0613',
                    stream: true,
                    functions: [weatherFunction],
                },
                messages: [
                    {
                        "role": "user",
                        "content": "What's the weather like in London?",
                    },
                ],
                onError: errorReceived,
                onProgress: (delta) => {
                    state.delta = mergeChatStreamDeltas(state.delta, delta);

                    if (allChoicesFinished(state.delta)) {
                        progressReceived(state.delta);
                    }
                },
            });

            await promise;

            expect(errorReceived).not.toBeCalled();
            expect(progressReceived).toBeCalled();
            expect(progressReceived.mock.calls).toHaveLength(1);

            expect(progressReceived.mock.calls[0][0]).toMatchObject({
                "created": expect.any(Number),
                "model": "gpt-3.5-turbo-0613",
                "object": "chat.completion.chunk",
                "id": expect.stringMatching(/^chatcmpl-/),
                "choices": [
                    {
                        "delta": {
                            "role": "assistant",
                            "content": null,
                            "function_call": {
                                "name": "get_current_weather",
                                "arguments": "{\n  \"location\": \"London\"\n}"
                            }
                        },
                        "index": 0,
                        "finish_reason": "function_call"
                    }
                ],
            });
        }, 10000);
    });

    describe('when cancelled', () => {
        it('should be cancellable before stream', async () => {
            const abort = new AbortController();

            const progressReceived = vi.fn();
            const errorReceived = vi.fn();

            abort.abort();

            const promise = getChatCompletionAdvanced({
                openai,
                messages: [{
                    role: 'user',
                    content: 'write a short line on testing',
                }],
                onError: errorReceived,
                onProgress: progressReceived,
                options: {
                    temperature: 0,
                    model: 'gpt-3.5-turbo',
                    stream: true,
                },
                signal: abort.signal,
            });

            await promise;

            expect(errorReceived).toBeCalled();
            expect(errorReceived.mock.calls).toHaveLength(1);
            expect(errorReceived.mock.lastCall).to.deep.eq([{
                message: 'Aborted',
                type: CompletionErrorType.Aborted,
            }]);

            expect(progressReceived).not.toBeCalled();
        }, 10000);
        it('should be cancellable mid-stream', async () => {
            let resultText = '';

            const abort = new AbortController();

            let resolveFunction: (() => void) | null = null;

            const firstResponsePromise = new Promise<void>(resolve => {
                resolveFunction = resolve;
            });

            const errorReceived = vi.fn();

            const promise = getChatCompletionAdvanced({
                openai,
                messages: [{
                    role: 'user',
                    content: 'write a short line on testing',
                }],
                onError: errorReceived,
                onProgress(result: ChatStreamDelta): void {
                    const content = result.choices[0].delta.content;

                    if (content) {
                        resultText += content;

                        console.log(resultText);

                        if (resolveFunction) {
                            resolveFunction();
                            resolveFunction = null;
                        }
                    }
                },
                options: {
                    temperature: 0,
                    model: 'gpt-3.5-turbo',
                    stream: true,
                },
                signal: abort.signal,
            });

            await firstResponsePromise;
            abort.abort();

            await promise;

            expect(errorReceived).toBeCalled();
            expect(errorReceived.mock.calls).toHaveLength(1);
            expect(errorReceived.mock.lastCall).to.deep.eq([{
                message: 'Stream aborted',
                type: CompletionErrorType.Aborted,
            }]);

            expect("Testing is a crucial step in software development that ensures the quality and functionality of the product.".startsWith(resultText)).to.be.true;
        }, 10000);
    });

    describe('when streaming', () => {
        it('should return the same result as non-streaming', async () => {
            const errorReceived = vi.fn();
            const progressReceived = vi.fn();

            const state = {
                delta: null as ChatStreamDelta | null,
            }

            const streamingPromise = getChatCompletionAdvanced({
                openai,
                options: {
                    temperature: 0,
                    model: 'gpt-3.5-turbo-0613',
                    stream: true,
                },
                messages: [
                    {
                        "role": "user",
                        "content": "Tell me a joke.",
                    },
                ],
                onError: errorReceived,
                onProgress: (delta) => {
                    state.delta = mergeChatStreamDeltas(state.delta, delta);

                    if (allChoicesFinished(state.delta)) {
                        progressReceived(state.delta);
                    }
                },
            });

            await streamingPromise;

            expect(errorReceived).not.toBeCalled();
            expect(progressReceived).toBeCalled();
            expect(progressReceived.mock.calls).toHaveLength(1);

            const nonStreamingPromise = getChatCompletionAdvanced({
                openai,
                options: {
                    temperature: 0,
                    model: 'gpt-3.5-turbo-0613',
                    stream: false,
                },
                messages: [
                    {
                        "role": "user",
                        "content": "Tell me a joke.",
                    },
                ],
                onError: errorReceived,
                onProgress: progressReceived,
            });

            await nonStreamingPromise;

            expect(errorReceived).not.toBeCalled();
            expect(progressReceived).toBeCalled();
            expect(progressReceived.mock.calls).toHaveLength(2);

            const expectedValue = structuredClone(progressReceived.mock.calls[0][0]);

            expectedValue.id = expect.stringMatching(/^chatcmpl-/);
            expectedValue.created = expect.any(Number);
            expectedValue.object = "chat.completion";
            expectedValue.usage = {
                completion_tokens: expect.any(Number),
                prompt_tokens: expect.any(Number),
                total_tokens: expect.any(Number),
            };

            expect(progressReceived.mock.calls[1][0]).toMatchObject(expectedValue);
        }, 100000);
    });
});
