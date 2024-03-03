import { DEBUG_LEVELS, ROUTE_IDENTIFIERS, log, validateData, validateMessage } from "./helpers";
import { generateHandleMousePosition } from "./routes/mousePosition";
import { generateHandleServiceStatus } from "./routes/status";
import { createMe } from "./global";
import { WebSocket } from "ws";
import { generateHandleUnsubscribe } from "./routes/unsubscribe";

export const generalSocketServer = new WebSocket.Server({
    noServer: true,
    clientTracking: true,
});

const handleMousePosition = generateHandleMousePosition();
const handleServiceStatus = generateHandleServiceStatus(generalSocketServer);

generalSocketServer.on("connection", (ws) => {
    const me = createMe({ 
        identifier: Math.random().toString(36).substring(7), 
        ws, 
        rooms: new Set<string>(),
    });

    const handleUnsubscribe = generateHandleUnsubscribe(me);

    ws.on("message", (msg) => {
        try {
            const parsed = JSON.parse(msg.toString()) as unknown;
            const validated = validateMessage(parsed);

            if (!validated)
                return log(DEBUG_LEVELS.ERROR, `Invalid message: ${msg}`);

            const dataValidated = validateData(validated);

            if (!dataValidated)
                return log(DEBUG_LEVELS.ERROR, `Invalid data: ${msg}`);

            me.rooms.add(dataValidated.event);

            // essentially a router
            switch (dataValidated.event) {
                case ROUTE_IDENTIFIERS.MOUSE_POSITION:
                    return handleMousePosition(dataValidated);
                case ROUTE_IDENTIFIERS.SERVICE_STATUS:
                    return handleServiceStatus(dataValidated);
                case ROUTE_IDENTIFIERS.UNSUBSCRIBE:
                    return handleUnsubscribe(dataValidated);
            }
            
        } catch (error) {
            log(DEBUG_LEVELS.ERROR, error);
        }
    })

});

export default {}