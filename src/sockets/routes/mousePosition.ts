import { Server, WebSocket } from "ws";
import { ROUTE_IDENTIFIERS, RouteDataTypes } from "../helpers";
import { IncomingMessage } from "http";

type TActivePointers = Array<RouteDataTypes.MousePosition['data'] & {
    lastUpdated: number
}>

const maxInactiveTime = 10000;
let activePointers: TActivePointers = [];
let socket: Server<typeof WebSocket, typeof IncomingMessage> | null = null

export const generateHandleMousePosition = (_socket: Server<typeof WebSocket, typeof IncomingMessage>) => {
    socket = _socket;
    activePointers = [];

    return ({ data }: RouteDataTypes.MousePosition) => {
        //update active Pointers or push new pointer
        const index = activePointers.findIndex((pointer) => pointer.username === data.username);
        if (index >= 0) {
            activePointers[index] = {
                ...data,
                lastUpdated: Date.now()
            };
        } else {
            activePointers.push({
                ...data,
                lastUpdated: Date.now()
            });
        }
    };
};

//send active pointers to all clients
setInterval(() => {
    socket?.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                event: ROUTE_IDENTIFIERS.MOUSE_POSITION,
                data: activePointers
            }));
        }
    });
}, 100);

//remove stale pointers on an interval
setInterval(() => {
    const now = Date.now();
    const stalePointers = activePointers.filter((pointer) => now - pointer.lastUpdated > maxInactiveTime);
    stalePointers.forEach((pointer) => {
        const index = activePointers.findIndex((activePointer) => activePointer.username === pointer.username);
        if (index >= 0) {
            activePointers.splice(index, 1);
        }
    });
}, 5000);