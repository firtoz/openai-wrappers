import {IncomingMessage} from "http";

export interface IncomingMessageWithOptionalSocket extends Omit<IncomingMessage, 'socket'> {
    socket: IncomingMessage['socket'] | null;
}
