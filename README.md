# @firtoz/openai-wrappers

This package provides a set of functions for working with the OpenAI API. Specifically, it provides functions for generating text completions and chat completions using the GPT-3 language model.

The package exports two sets of functions: `getCompletionAdvanced` and `getCompletionSimple` for text completions, and `getChatCompletionAdvanced` and `getChatCompletionSimple` for chat completions. The "advanced" functions provide more options for customizing the completions, while the "simple" functions provide a more streamlined interface for basic use cases.

To use this package, you will need an API key from OpenAI. You can sign up for an API key on the OpenAI website. Once you have an API key, you can create an instance of the `OpenAIApi` class from the `openai` package, and pass it to the completion functions along with the appropriate parameters.

For more information on how to use this package, see the documentation below.

## OpenAI Completion Functions

### `getCompletionAdvanced`

```ts
async function getCompletionAdvanced(
  openai: OpenAIApi,
  prompt: string,
  options: Partial<CompletionParams> = {},
  onProgress: (result: CreateCompletionResponse) => void,
  onError: (error: CustomCompletionError) => void,
): Promise<void>
```

This function generates text completions using the OpenAI API with advanced options. It takes the following parameters:

- `openai`: An instance of the `OpenAIApi` class from the `openai` package.
- `prompt`: The text prompt to generate completions for.
- `options`: An optional object containing additional options for the completion. The available options are:
  - `model`: The ID of the model to use for the completion. Defaults to `"text-davinci-003"`.
  - `temperature`: Controls the "creativity" of the generated text. Higher values result in more creative output. Defaults to `0.7`.
  - `max_tokens`: The maximum number of tokens to generate in the completion. Defaults to `512`.
  - `top_p`: Controls the diversity of the generated text. Higher values result in more diverse output. Defaults to `0.9`.
  - `frequency_penalty`: Controls the repetition of the generated text. Higher values result in less repetition. Defaults to `0`.
  - `presence_penalty`: Controls the relevance of the generated text to the prompt. Higher values result in more relevant output. Defaults to `0`.
  - `stream`: Whether to use streaming mode for the completion. Defaults to `false`.
- `onProgress`: A callback function that is called with each progress update from the API. The function is passed a `CreateCompletionResponse` object.
- `onError`: A callback function that is called if an error occurs during the completion. The function is passed a `CustomCompletionError` object.

### `getCompletionSimple`

```ts
async function getCompletionSimple(
  openai: OpenAIApi,
  prompt: string,
  options: Partial<CompletionParams> = {},
  onProgress?: (result: string, finished: boolean) => void
): Promise<string>
```

This function generates text completions using the OpenAI API with simple options. It takes the following parameters:

- `openai`: An instance of the `OpenAIApi` class from the `openai` package.
- `prompt`: The text prompt to generate completions for.
- `options`: An optional object containing additional options for the completion. The available options are the same as for `getCompletionAdvanced`.
- `onProgress`: An optional callback function that is called with each progress update from the API. The function is passed a string containing the latest generated text and a boolean indicating whether the completion is finished.

Both functions return a Promise that resolves to a string containing the generated text completion. If an error occurs during the completion, the Promise will be rejected with an error object.

## OpenAI Chat Completion Functions

### `getChatCompletionAdvanced`

```ts
async function getChatCompletionAdvanced(
  openai: OpenAIApi,
  messages: ChatCompletionRequestMessage[],
  options: Partial<ChatCompletionOptions> = {},
  onProgress: (result: ChatStreamDelta) => void,
  onError: (error: CustomCompletionError) => void,
): Promise<void>
```

This function takes in the following parameters:

- `openai`: An instance of the `OpenAIApi` class from the `openai` package.
- `messages`: An array of `ChatCompletionRequestMessage` objects that represent the conversation history.
- `options`: An optional object that contains the following properties:
  - `model`: The name of the GPT-3 model to use. Defaults to `"gpt-3.5-turbo"`.
  - `temperature`: Controls the "creativity" of the responses. Higher values result in more creative responses. Defaults to `0.7`.
  - `top_p`: Controls the "quality" of the responses. Higher values result in higher quality responses. Defaults to `0.9`.
  - `frequency_penalty`: Controls the "repetition" of the responses. Higher values result in less repetition. Defaults to `0`.
  - `presence_penalty`: Controls the "diversity" of the responses. Higher values result in more diverse responses. Defaults to `0`.
  - `stream`: A boolean value that indicates whether to use streaming or not. Defaults to `false`.
- `onProgress`: A callback function that is called every time a new response is received. The function takes in a `ChatStreamDelta` object that represents the new response.
- `onError`: A callback function that is called if an error occurs. The function takes in a `CustomCompletionError` object that represents the error.

This function returns a Promise that resolves when the conversation is complete.

### `getChatCompletionSimple`

```ts
async function getChatCompletionSimple(
  openai: OpenAIApi,
  messages: ChatCompletionRequestMessage[],
  options: Exclude<Partial<ChatCompletionOptions>, 'stream'> = {},
): Promise<string>;
```

This function takes in the following parameters:

- `openai`: An instance of the `OpenAIApi` class from the `openai` package.
- `messages`: An array of `ChatCompletionRequestMessage` objects that represent the conversation history.
- `options`: An optional object that contains the same properties as the `options` parameter of the `getChatCompletion` function, except for the `stream` property.

This function returns a Promise that resolves with the final response from the conversation.
