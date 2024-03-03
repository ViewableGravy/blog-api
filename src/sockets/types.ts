import { ValueOf } from "../utilities/types"
import { ROUTE_IDENTIFIERS } from "./helpers"

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

    export type ServiceStatus = {
        event: typeof ROUTE_IDENTIFIERS.SERVICE_STATUS
    }

    export type Unsubscribe = {
        event: typeof ROUTE_IDENTIFIERS.UNSUBSCRIBE,
        data: Array<ValueOf<typeof ROUTE_IDENTIFIERS>>
    }
}