/***** BASE IMPORTS *****/
import axios from "axios";
import WebSocket, { type Server } from "ws";
import { type IncomingMessage } from "http";

/***** CONSTS *****/
import { ROUTE_IDENTIFIERS } from "../helpers";
import { clients, getClientsInRoom } from "../global";

/***** CONSTANTS *****/
const KUMA_KEY = process.env.KUMA_KEY;

/***** API *****/
const API = {
    status: {
        active: async () => {
            const authOptions = {
                headers: { 
                    'Authorization': 'Basic ' + (Buffer.from(`key:${KUMA_KEY}`).toString('base64'))
                }
            }

            //do some translation here before returning
            const { data } = await axios.get('https://kuma.gravy.cc/metrics', authOptions).catch((err) => {
                return {
                    data: ''
                }
            });

            return data
                .split('\n')
                .map((line: string) => {
                    if (!line.startsWith('monitor_status'))
                        return;

                    const splitDetails = line
                        .split(/\d$/g)[0]
                        .replace('monitor_status', '')
                        .split(',')
                        .map((value: string, index) => {
                            const [key, val] = value.split('=');

                            if (index === 0)
                                return `{ "monitor_name": ${val}`

                            return `"${key}": ${val}`
                        })
                        .join(',')
                    
                    const details = JSON.parse(splitDetails);

                    return {
                        ...details,
                        status: line.endsWith('1') ? 'up' : 'down'
                    }
                })
                .filter((value: any) => value !== undefined);
        }
    }
}

const getServiceStatus = async () => {
    const response = await API.status.active();

    //Strip out private information
    const filtered = response.map((service: any) => {
        if (service.monitor_type === 'http') {
            return {
                monitor_name: service.monitor_name,
                status: service.status,
                url: service.url,
                type: service.monitor_type,
            }
        }

        if (service.monitor_type === 'port') {
            return {
                monitor_name: service.monitor_name,
                status: service.status,
                port: service.hostname,
                type: service.monitor_type,
            }
        }

        if (service.monitor_type === 'ping') {
            return {
                monitor_name: service.monitor_name,
                status: service.status,
                type: service.monitor_type,
            }
        }

        return service;
    });

    getClientsInRoom(ROUTE_IDENTIFIERS.SERVICE_STATUS).forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(JSON.stringify({
                event: ROUTE_IDENTIFIERS.SERVICE_STATUS,
                data: filtered
            }));
        }
    });
};

/***** Intervals *****/
if (process.env.ACTIVE_KUMA_STATUS !== 'inactive') {
    setInterval(async () => {
        getServiceStatus();
    }, 5000)
}

/***** SERVER *****/
export const handleServiceStatus = (data: unknown) => {}