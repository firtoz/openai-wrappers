# @firtoz/openai-wrappers

This package provides a set of functions for working with the OpenAI API. Specifically, it provides functions for
generating text completions and chat completions using the GPT-3 and 4 language models.

The package exports two sets of functions: `getCompletionAdvanced` and `getCompletionSimple` for text completions,
and `getChatCompletionAdvanced` and `getChatCompletionSimple` for chat completions. The "advanced" functions provide
more options for customizing the completions, while the "simple" functions provide a more streamlined interface for
basic use cases.

To use this package, you will need an API key from OpenAI. You can sign up for an API key on the OpenAI website. Once
you have an API key, you can create an instance of the `OpenAIApi` class from the `openai` package, and pass it to the
completion functions along with the appropriate parameters.

For more information on how to use this package, see the documentation below.

## Usage:

```ts
import {getChatCompletionSimple} from '@firtoz/openai-wrappers';
import {Configuration, OpenAIApi} from 'openai';

const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));

getChatCompletionSimple({
    openai: openai,
    messages: [
        {
            role: 'user',
            name: 'System',
            content: `Please translate this phrase to French.

Phrase: Hello, world! I'm ready for you!
`,
        }
    ],
    options: {
        temperature: 0.9,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
        user: 'test',
    },
}).then(result => console.log({result}));
```

Should print:

```ts
{
    result: 'Bonjour, monde! Je suis prêt pour toi!'
}
```

Advanced:

```ts
import {getChatCompletionAdvanced} from '@firtoz/openai-wrappers';
import {Configuration, OpenAIApi} from 'openai';

const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));

getChatCompletionAdvanced({
    openai: openai,
    messages: [
        {
            role: 'user',
            name: 'System',
            content: `Please translate this phrase to French.

Phrase: Hello, world! I'm ready for you!
`,
        }
    ],
    options: {
        temperature: 0.9,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
        user: 'test',
    },
    onProgress: result => console.log(JSON.stringify(result, null, '    ')),
    onError: console.error,
});
```

Will print:

```json
{
  "created": 1677938435,
  "model": "gpt-3.5-turbo-0301",
  "object": "chat.completion",
  "id": "chatcmpl-XXXXXXXX",
  "choices": [
    {
      "delta": {
        "role": "assistant",
        "content": "Bonjour le monde ! Je suis prêt pour toi !"
      },
      "index": 0,
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 26,
    "completion_tokens": 13,
    "total_tokens": 39
  }
}
```

Streaming:

Code:

```ts
getChatCompletionAdvanced({
    openai: openai,
    messages: [
        {
            role: 'user',
            name: 'System',
            content: `Please translate this phrase to French.

Phrase: Hello, world! I'm ready for you!
`,
        }
    ],
    options: {
        temperature: 0.9,
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
        user: 'test',
        stream: true,
    },
    onProgress: result => console.log(JSON.stringify(result, null, '  ')),
    onError: console.error,
});
```

<details>
<summary>
Will print (click the arrow on the left to expand):
</summary>

```json lines
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "role": "assistant"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": "Bonjour"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": ","
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": " monde"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": "!"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": " Je"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": " suis"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": " pr"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": "êt"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": " pour"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": " toi"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {
        "content": "!"
      },
      "index": 0,
      "finish_reason": null
    }
  ]
}
{
  "id": "chatcmpl-6qMnQVnscsXNbjcajTTg2ibLuxFJz",
  "object": "chat.completion.chunk",
  "created": 1677938704,
  "model": "gpt-3.5-turbo-0301",
  "choices": [
    {
      "delta": {},
      "index": 0,
      "finish_reason": "stop"
    }
  ]
}
```

</details>

## OpenAI Chat Completion Functions

### `getChatCompletionAdvanced`

```ts

declare interface ChatCompletionAdvancedParams {
    openai: OpenAIApi;
    messages: ChatCompletionRequestMessage[];
    options: Partial<ChatCompletionOptions>;
    onProgress: (result: ChatStreamDelta) => void;
    onError: (error: CustomCompletionError) => void;
    signal?: AbortSignal;
    axiosConfig?: Omit<AxiosRequestConfig, 'signal' | 'responseType'>;
}

declare async function getChatCompletionAdvanced(
    {
        openai,
        messages,
        options = {},
        onProgress,
        onError,
        signal,
    }: ChatCompletionAdvancedParams,
): Promise<void>;
```

This function takes in the following parameters in a param object:

- `openai`: An instance of the `OpenAIApi` class from the `openai` package.
- `messages`: An array of `ChatCompletionRequestMessage` objects that represent the conversation history.
- `options`: An optional object that contains the following properties:
    - `model`: The name of the GPT-3 model to use. Defaults to `"gpt-3.5-turbo"`.
    - `temperature`: Controls the "creativity" of the responses. Higher values result in more creative responses.
      Defaults to `0.7`.
    - `top_p`: Controls the "quality" of the responses. Higher values result in higher quality responses. Defaults
      to `0.9`.
    - `frequency_penalty`: Controls the "repetition" of the responses. Higher values result in less repetition. Defaults
      to `0`.
    - `presence_penalty`: Controls the "diversity" of the responses. Higher values result in more diverse responses.
      Defaults to `0`.
    - `stream`: A boolean value that indicates whether to use streaming or not. Defaults to `false`.
- `onProgress`: A callback function that is called every time a new response is received. The function takes in
  a `ChatStreamDelta` object that represents the new response.
- `onError`: A callback function that is called if an error occurs. The function takes in a `CustomCompletionError`
  object that represents the error.
- `signal`: An optional `AbortSignal` instance to cancel the request if needed.
- `axiosConfig`: An optional `AxiosRequestConfig` object for additional axios options.

This function returns a Promise that resolves when the conversation is complete.

### `getChatCompletionSimple`

```ts
declare interface ChatCompletionSimpleParams {
    openai: OpenAIApi;
    messages: ChatCompletionRequestMessage[];
    options?: Exclude<Partial<ChatCompletionOptions>, "stream">;
    signal?: AbortSignal;
}

declare async function getChatCompletionSimple(
    {
        openai,
        messages,
        options = {},
        signal,
    }: ChatCompletionSimpleParams,
): Promise<string>;
```

This function takes in the following parameters in a param object:

- `openai`: An instance of the `OpenAIApi` class from the `openai` package.
- `messages`: An array of `ChatCompletionRequestMessage` objects that represent the conversation history.
- `options`: An optional object that contains the same properties as the `options` parameter of the `getChatCompletion`
  function, except for the `stream` property.
- `signal`: An optional `AbortSignal` instance to cancel the request if needed.

This function returns a Promise that resolves with the final response from the conversation.


## OpenAI Completion Functions

### getCompletionAdvanced

```ts
export interface CompletionAdvancedParams {
    openai: OpenAIApi;
    prompt: string;
    options: Partial<CompletionParams>;
    onProgress: (result: CreateCompletionResponse) => void;
    onError: (error: CustomCompletionError) => void;
    signal?: AbortSignal;
}

declare async function getCompletionAdvanced(
    {openai, prompt, options = {}, onProgress, onError, signal}: CompletionAdvancedParams,
): Promise<void>;

```

This function generates text completions using the OpenAI API with advanced options.
It takes the following parameters as a param object:

- `openai`: An instance of the `OpenAIApi` class from the `openai` package.
- `prompt`: The text prompt to generate completions for.
- `options`: An optional object containing additional options for the completion. The available options are:
    - `model`: The ID of the model to use for the completion. Defaults to `"text-davinci-003"`.
    - `temperature`: Controls the "creativity" of the generated text. Higher values result in more creative output.
      Defaults to `0.7`.
    - `max_tokens`: The maximum number of tokens to generate in the completion. Defaults to `512`.
    - `top_p`: Controls the diversity of the generated text. Higher values result in more diverse output. Defaults
      to `0.9`.
    - `frequency_penalty`: Controls the repetition of the generated text. Higher values result in less repetition.
      Defaults to `0`.
    - `presence_penalty`: Controls the relevance of the generated text to the prompt. Higher values result in more
      relevant output. Defaults to `0`.
    - `stream`: Whether to use streaming mode for the completion. Defaults to `false`.
- `onProgress`: A callback function that is called with each progress update from the API. The function is passed
  a `CreateCompletionResponse` object.
- `onError`: A callback function that is called if an error occurs during the completion. The function is passed
  a `CustomCompletionError` object.
- `signal`: An optional `AbortSignal` instance to cancel the request if needed.

### `getCompletionSimple`

```ts
declare interface CompletionSimpleParams {
    openai: OpenAIApi;
    prompt: string;
    options?: Partial<CompletionParams>;
    onProgress?: (result: string, finished: boolean) => void;
    signal?: AbortSignal;
}

declare async function getCompletionSimple(
    {openai, prompt, options = {}, onProgress, signal}: CompletionSimpleParams,
): Promise<string>;
```

This function generates text completions using the OpenAI API with simple options.
It takes the following parameters as a param object:

- `openai`: An instance of the `OpenAIApi` class from the `openai` package.
- `prompt`: The text prompt to generate completions for.
- `options`: An optional object containing additional options for the completion. The available options are the same as
  for `getCompletionAdvanced`.
- `onProgress`: An optional callback function that is called with each progress update from the API. The function is
  passed a string containing the latest generated text and a boolean indicating whether the completion is finished.
- `signal`: An optional `AbortSignal` instance to cancel the request if needed.

Both functions return a Promise that resolves to a string containing the generated text completion. If an error occurs
during the completion, the Promise will be rejected with an error object.

