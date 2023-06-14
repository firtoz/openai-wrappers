import {it, expect, describe, vi} from 'vitest';
import {Configuration, OpenAIApi} from "openai";
import {ChatStreamDelta, CompletionErrorType, getChatCompletionAdvanced} from "../src";


const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));

describe('getChatCompletionAdvanced', () => {
    it.only('should allow functions', async () => {
        const errorReceived = vi.fn();
        const progressReceived = vi.fn();

        const promise = getChatCompletionAdvanced({
            openai,
            options: {
                temperature: 0,
                model: 'gpt-3.5-turbo-0613',
                stream: false,
                functions: [
                    {
                        "name": "get_current_weather",
                        "description": "Get the current weather in a given location",
                        "parameters": {
                            "type": "object",
                            "properties": {
                                "location": {
                                    "type": "string",
                                    "description": "The city and state, e.g. San Francisco, CA",
                                },
                                "unit": {"type": "string", "enum": ["celsius", "fahrenheit"]},
                            },
                            "required": ["location"],
                        },
                    }
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

        /* example output:
{
  "created": 1686738426,
  "model": "gpt-3.5-turbo-0613",
  "object": "chat.completion",
  "id": "chatcmpl-7RI0Qk2aDXAoTuduw4NtMTR5kx1V1",
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
  "usage": {
    "prompt_tokens": 82,
    "completion_tokens": 16,
    "total_tokens": 98
  }
}
*/
        // instead of numbers and ids use regex
        // TODO: maybe need to do that for the usage object too
        expect(progressReceived.mock.calls[0][0]).to.toMatchObject({
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
                            "name": "get_current_weather",
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
            }
        });
    }, 10000)

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
