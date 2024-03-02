/***** BASE IMPORTS *****/
import axios from "axios";
import WebSocket from "ws";

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
                console.log(err);
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

/***** SERVER *****/
export const wsServerStatus = new WebSocket.Server({
    noServer: true
})  

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

    console.log('sending statuses: ', wsServerStatus.clients.size)
    wsServerStatus.clients.forEach((client) => {
        client.send(JSON.stringify(filtered));
    })
};

if (process.env.ACTIVE_KUMA_STATUS !== 'inactive') {
    setInterval(async () => {
        getServiceStatus();
    }, 5000)
}

wsServerStatus.on("connection", function(ws: any) {    // what should a websocket do on connection
    console.log("Someone has loaded my website");
    getServiceStatus();
    ws.on("message", function(msg: any) {        // what to do on message event
        wsServerStatus.clients.forEach(function each(client: any) {
            if (client.readyState === WebSocket.OPEN) {     // check if client is ready
                client.send(msg.toString());
            }
        });
    });
});