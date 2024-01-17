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

    //has data
    if (!('data' in msg)) return null;

    return msg as {
        event: string, 
        data: unknown
    };
}

/**
 * Standard logging for websocket messages
 */
export const log = (level: typeof DEBUG_LEVELS[keyof typeof DEBUG_LEVELS], message: unknown) => {
    if (typeof message === 'object') 
        message = JSON.stringify(message);

    console.log(`[${level}] ${message}`);
}

export namespace RouteDataTypes {
    export type MousePosition = {
        event: typeof ROUTE_IDENTIFIERS.MOUSE_POSITION,
        data: {
            x: number,
            y: number,
            route: string,
            username: string,
        }
    }
}

type TValidatorRT = RouteDataTypes.MousePosition // | ...

export const ROUTE_IDENTIFIERS = {
    MOUSE_POSITION: 'mousePosition',
} as const;

export const DEBUG_LEVELS = {
    INFO: 'INFO',
    ERROR: 'ERROR',
    DEBUG: 'DEBUG',
} as const;

export const ROUTE_VALIDATORS = {
    [ROUTE_IDENTIFIERS.MOUSE_POSITION]: (message: ReturnType<typeof validateMessage>) => {
        if (!message) return null;
        if (!('data' in message)) return null;
        if (!message.data) return null;

        const { data } = message;

        if (typeof data !== 'object') return null;
        if (!('x' in data)) return null
        if (!('y' in data)) return null
        if (!('route' in data)) return null
        if (!('username' in data)) return null

        if (typeof data.x !== 'number') return null
        if (typeof data.y !== 'number') return null
        if (typeof data.route !== 'string') return null
        if (typeof data.username !== 'string') return null

        return {
            ...message,
            data
        }
    }
} as Record<string, (data: ReturnType<typeof validateMessage>) => TValidatorRT>;

export const validateData = (data: NonNullable<ReturnType<typeof validateMessage>>) => {
    const validator = ROUTE_VALIDATORS[data.event];

    if (!validator) return null;

    return validator(data);
}