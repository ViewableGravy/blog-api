import { z } from "zod";
import { RouteDataTypes } from "./types";

/**
 * Should be in the following shape
 * ```ts
 * {
 *   type: string,
 *   data: unknown
 * }
 * ```
 */
export const validateMessage = (msg: unknown) => {
    //exists
    if (!msg) return null;

    //is object
    if (typeof msg !== 'object') return null;

    //has type and it is string
    if (!('event' in msg) || typeof msg.event !== 'string') return null;

    return msg as {
        event: string, 
        data: unknown
    };
}

type ValidatedMessage = NonNullable<ReturnType<typeof validateMessage>>;

/**
 * Standard logging for websocket messages
 */
export const log = (level: typeof DEBUG_LEVELS[keyof typeof DEBUG_LEVELS], message: unknown) => {
    if (typeof message === 'object') 
        message = JSON.stringify(message);

    console.log(`[${level}] ${message}`);
}

export const ROUTE_IDENTIFIERS = {
    MOUSE_POSITION: 'mousePosition',
    SERVICE_STATUS: 'serviceStatus',
    UNSUBSCRIBE: 'unsubscribe'
} as const;

export const DEBUG_LEVELS = {
    INFO: 'INFO',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG',
} as const;

export const ROUTE_VALIDATORS = {
    [ROUTE_IDENTIFIERS.MOUSE_POSITION]: (message: ValidatedMessage): RouteDataTypes.MousePosition | null => {
        const _validator = z.object({
            data: z.object({
                x: z.number(),
                y: z.number(),
                route: z.string(),
                username: z.string(),
            })
        });

        const validated = _validator.safeParse(message);

        return validated.success ? {
            event: ROUTE_IDENTIFIERS.MOUSE_POSITION,
            data: validated.data.data
        } : null;
    },
    [ROUTE_IDENTIFIERS.SERVICE_STATUS]: (_?: ValidatedMessage): RouteDataTypes.ServiceStatus => {
        return {
            event: ROUTE_IDENTIFIERS.SERVICE_STATUS,
        }
    },
    [ROUTE_IDENTIFIERS.UNSUBSCRIBE]: (message: ValidatedMessage): RouteDataTypes.Unsubscribe | null => {
        const _validator = z.object({
            data: z.array(
                z.union([
                    z.literal(ROUTE_IDENTIFIERS.MOUSE_POSITION),
                    z.literal(ROUTE_IDENTIFIERS.SERVICE_STATUS)
                ])
            )
        });

        const validated = _validator.safeParse(message);

        return validated.success ? {
            event: ROUTE_IDENTIFIERS.UNSUBSCRIBE,
            data: validated.data.data
        } : null;
    }
} as const;

const isKeyOf = <T extends { [key in string]: any }>(obj: T, key: string): key is T extends Record<string, any> ? keyof T : never => key in obj;

export const validateData = (data: ValidatedMessage) => {
    if (isKeyOf(ROUTE_VALIDATORS, data.event)) 
        return ROUTE_VALIDATORS[data.event](data);
    else
        return null;
}