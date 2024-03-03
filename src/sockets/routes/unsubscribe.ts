import { TClient, removeClientFromRoom } from "../global";
import { ROUTE_IDENTIFIERS } from "../helpers";
import { RouteDataTypes } from "../types";

type TGenerateHandleUnsubscribe = (me: TClient) => (data: RouteDataTypes.Unsubscribe) => void;

export const generateHandleUnsubscribe: TGenerateHandleUnsubscribe = ({ identifier }) => ({ data: rooms }) => {
    rooms.forEach((room) => {
        removeClientFromRoom(room, identifier);
    });

    removeClientFromRoom(ROUTE_IDENTIFIERS.UNSUBSCRIBE, identifier);
};