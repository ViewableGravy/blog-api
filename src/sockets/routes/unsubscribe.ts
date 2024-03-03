/***** CONSTS *****/
import { ROUTE_IDENTIFIERS } from "../helpers";
import { type RouteDataTypes } from "../types";
import { TClient, removeClientFromRoom } from "../global";

/***** TYPE DEFINITIONS *****/
type TGenerateHandleUnsubscribe = (me: TClient) => (data: RouteDataTypes.Unsubscribe) => void;

/***** COMPONENT START *****/
export const generateHandleUnsubscribe: TGenerateHandleUnsubscribe = ({ identifier }) => ({ data: rooms }) => {
    rooms.forEach((room) => {
        removeClientFromRoom(room, identifier);
    });

    removeClientFromRoom(ROUTE_IDENTIFIERS.UNSUBSCRIBE, identifier);
};