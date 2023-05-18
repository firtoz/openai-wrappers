// noinspection JSUnusedGlobalSymbols

import {
    AxiosAdapter,
    AxiosError,
    AxiosHeaders,
    AxiosResponse,
    InternalAxiosRequestConfig,
} from "axios";

import {PassThrough} from 'stream';

function createTimeoutPromise(config: InternalAxiosRequestConfig, request: Request): Promise<AxiosError> {
    return new Promise((resolve) => {
        setTimeout(() => {
            const message = config.timeoutErrorMessage
                ? config.timeoutErrorMessage
                : 'timeout of ' + config.timeout + 'ms exceeded';
            resolve(
                new AxiosError(message, 'ECONNABORTED', config, request),
            );
        }, config.timeout);
    })
}

function getStatusErrorType(status: number): string {
    const statusCodeCategory = Math.floor(status / 100);

    switch (statusCodeCategory) {
        case 4:
            return AxiosError.ERR_BAD_REQUEST;
        case 5:
            return AxiosError.ERR_BAD_RESPONSE;
        default:
            return 'ERR_UNKNOWN';
    }
}

const fetchAdapter: AxiosAdapter = async (config: InternalAxiosRequestConfig): Promise<AxiosResponse> => {
    const abortController = new AbortController();

    const request = createRequest(config, abortController);

    // noinspection ES6MissingAwait
    const promiseChain = [
        getResponse(request, config, abortController),
    ];

    if (config.timeout && config.timeout > 0) {
        promiseChain.push(
            createTimeoutPromise(config, request),
        );
    }

    const data = await Promise.race(promiseChain);
    return new Promise((resolve, reject) => {
        if (data instanceof Error) {
            reject(data);
        } else {
            const validateStatus = data.config.validateStatus;
            if (!data.status || !validateStatus || validateStatus(data.status)) {
                resolve(data);
            } else {
                reject(new AxiosError(
                    'Request failed with status code ' + data.status,
                    getStatusErrorType(data.status),
                    data.config,
                    data.request,
                    data
                ));
            }
        }
    });
};

export default fetchAdapter;

class StreamWrapper {
    private passthrough: PassThrough | null = null;

    constructor(
        body: ReadableStream<Uint8Array> | null,
        private request: Request,
        private abortController: AbortController
    ) {
        if (body === null) {
            return;
        }

        const reader = body.getReader();
        const textDecoder = new TextDecoder();

        const passthrough = new PassThrough({
            signal: this.abortController.signal,
        });

        this.passthrough = passthrough;

        const pump = () => {
            reader
                .read()
                .then(({done, value}) => {
                    // When no more data needs to be consumed, close the stream
                    if (done) {
                        this.passthrough?.end();
                        // controller.close();
                        return;
                    }

                    const decoded = textDecoder.decode(value);

                    passthrough.write(decoded);

                    pump();
                });
        };

        pump();
    }

    on(eventName: string | symbol, callback: (...args: unknown[]) => void) {
        this.passthrough?.on(eventName, callback);
    }

    once(eventName: string | symbol, callback: (...args: unknown[]) => void) {
        this.passthrough?.once(eventName, callback);
    }

    off(eventName: string | symbol, callback: (...args: unknown[]) => void) {
        this.passthrough?.off(eventName, callback);
    }

    get socket() {
        return {
            end: () => {
                this.abortController.abort();
            }
        };
    }
}

interface DataByResponseTypeParams {
    request: Request;
    response: Response;
    abortController: AbortController;
    responseType?: string;
}

async function getDataByResponseType({
                                         request,
                                         response,
                                         abortController,
                                         responseType,
                                     }: DataByResponseTypeParams) {
    switch (responseType) {
        case 'document':
            return await response.formData();
        case 'stream':
            return new StreamWrapper(response.body, request, abortController);
        case 'arraybuffer':
            return await response.arrayBuffer();
        case 'blob':
            return await response.blob();
        case 'json':
            return await response.json();
        default:
            return await response.text();
    }
}

/**
 * Fetch API stage two is to get response body. This function tries to retrieve
 * response body based on response's type
 */
async function getResponse(
    request: Request,
    config: InternalAxiosRequestConfig,
    abortController: AbortController,
): Promise<AxiosResponse | AxiosError> {
    request.signal
    let stageOne: Response;
    try {
        stageOne = await fetch(request);
    } catch (e) {
        return new AxiosError('Network Error', 'ERR_NETWORK', config, request);
    }

    const axiosHeaders = new AxiosHeaders();

    const entries = stageOne.headers;
    for (const entry of entries) {
        axiosHeaders.set(entry[0], entry[1]);
    }

    const response: AxiosResponse = {
        data: undefined,
        // ok: stageOne.ok,
        status: stageOne.status,
        statusText: stageOne.statusText,
        headers: axiosHeaders, // Make a copy of headers
        config: config,
        request,
    };

    if (stageOne.status >= 200 && stageOne.status !== 204) {
        response.data = await getDataByResponseType({
            request: request,
            response: stageOne,
            abortController: abortController,
            responseType: config.responseType
        });
    }

    return response;
}


const typeOfTest = (type: string) => (thing: unknown) => typeof thing === type;

const isFunction = typeOfTest('function');

const kindOf = (cache => (thing: unknown) => {
    const str = toString.call(thing);
    return cache[str] || (cache[str] = str.slice(8, -1).toLowerCase());
})(Object.create(null));

/**
 * Determine if a value is a FormData
 *
 * @param {*} thing The value to test
 *
 * @returns {boolean} True if value is an FormData, otherwise false
 */
const isFormData = (thing: unknown) => {
    if (thing) {
        if (typeof FormData === 'function' && thing instanceof FormData) {
            return true;
        }

        if (isFunction((thing as { append: unknown }).append)) {
            const kind = kindOf(thing);

            if (kind === 'formdata') {
                return true;
            }

            if (kind === 'object') {
                return isFunction(thing.toString) && thing.toString() === '[object FormData]'
            }
        }
    }

    return false;
}


/**
 * This function will create a Request object based on configuration's axios
 */
function createRequest(config: InternalAxiosRequestConfig, abortController: AbortController) {
    const headers = new Headers(config.headers);

    // HTTP basic authentication
    if (config.auth) {
        const username = config.auth.username || '';
        const password = config.auth.password ? decodeURI(encodeURIComponent(config.auth.password)) : '';

        const auth = Buffer.from(`${username}:${password}`, 'binary').toString('base64');

        headers.set('Authorization', `Basic ${auth}`);
    }

    const method = config.method?.toUpperCase();
    const options: RequestInit = {
        headers: headers,
        method,
    };
    if (method !== 'GET' && method !== 'HEAD') {
        options.body = config.data;

        // In these cases the browser will automatically set the correct Content-Type,
        // but only if that header hasn't been set yet. So that's why we're deleting it.
        if (isFormData(options.body)) {
            headers.delete('Content-Type');
        }
    }
    if (config.signal) {
        if (config.signal.addEventListener) {
            config.signal.addEventListener('abort', () => {
                abortController.abort();
            });
        }
    }

    options.signal = abortController.signal;

    // This config is similar to XHR’s withCredentials flag, but with three available values instead of two.
    // So if withCredentials is not set, default value 'same-origin' will be used
    if (config.withCredentials !== undefined) {
        options.credentials = config.withCredentials ? 'include' : 'omit';
    }

    // Expected browser to throw error if there is any wrong configuration value
    return new Request(config.url ?? '', options);
}
