import axios, {AxiosResponse} from "axios";

const JSON_HEADERS = {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
} as const;

export async function getJson<T>(url: string): Promise<T> {
    const response: AxiosResponse<T> = await axios.get(url, {
        headers: JSON_HEADERS,
    });
    return response.data;
}
