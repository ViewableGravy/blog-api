import { WebSocket } from "ws";
import { DEBUG_LEVELS, ROUTE_IDENTIFIERS, log, validateData, validateMessage } from "./helpers";
import { generateHandleMousePosition } from "./routes/mousePosition";

export const generalSocketServer = new WebSocket.Server({
    noServer: true
});

generalSocketServer.on("connection", (ws) => {
    const handleMousePosition = generateHandleMousePosition(generalSocketServer);
    console.log('connection')

    ws.on("message", (msg) => {
        try {
            const parsed = JSON.parse(msg.toString()) as unknown;
            const validated = validateMessage(parsed);

            if (!validated)
                return log(DEBUG_LEVELS.ERROR, `Invalid message: ${msg}`);

            const dataValidated = validateData(validated);

            if (!dataValidated)
                return log(DEBUG_LEVELS.ERROR, `Invalid data: ${msg}`);

            switch (dataValidated.event) {
                case ROUTE_IDENTIFIERS.MOUSE_POSITION:
                    handleMousePosition(dataValidated);
            }
            
        } catch (error) {
            log(DEBUG_LEVELS.ERROR, error);
        }
    })

    ws.send('hi')

});