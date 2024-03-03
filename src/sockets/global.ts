/***** BASE IMPORTS *****/
import { WebSocket } from "ws";

/***** TYPE DEFINITIONS *****/
export type TClient = {
    identifier: string,
    ws: WebSocket,
    rooms: Set<string>,
}

/***** STATE *****/
export const clients: Array<TClient> = [];

/***** INTERVALS *****/
setInterval(() => {
    clients.forEach(({ ws, identifier }) => {
        if (ws.readyState === ws.CLOSED) {
            const index = clients.findIndex(x => x.identifier === identifier);
            clients.splice(index, 1);
        }
    });

    console.log('clientIdentifiers: ', clients.map(({ ws, ...rest }) => rest));
}, 10000);

/***** HELPER FUNCTIONS *****/
export const createMe = (props: TClient) => {
    clients.push(props);

    return props;
};

export const getClientsInRoom = (room: string) => {
    return clients.filter(client => client.rooms.has(room));
}

export const removeClientFromRoom = (room: string, identifier: string) => {
    const client = clients.find(client => client.identifier === identifier);

    if (client) {
        client.rooms.delete(room);
    }
}

