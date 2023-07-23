import { MongoClient, ObjectId } from 'mongodb';
import { loginRoute, loginRouteValidator } from './routes/login';
import { createDraftRoute, createDraftValidator } from './routes/createDraft';
import { deleteDraftRoute, deleteDraftValidator } from './routes/deleteDraft';
import { deletePostRoute, deletePostValidator } from './routes/deletePost';
import { authToken, captchaMiddleware } from './middleware/authentication'
import { upsertDraftRoute, upsertDraftValidator } from './routes/upsertDraftMeta';
import { deleteContentRoute, deleteContentValidator } from './routes/paragraph/delete';
import { publishDraftRoute, publishDraftValidator } from './routes/publishDraft';
import { insertParagraphRoute, insertParagraphValidator } from './routes/paragraph/insert';
import { putParagraphRoute, putParagraphValidator } from './routes/paragraph/override';
import { patchParagraphRoute, patchParagraphValidator } from './routes/paragraph/patch';
import { refreshTokenRoute } from './routes/refreshToken';
import * as postContent from './schema/post';
import * as TypedRequest from './schema/TypedRequests';
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import cors from 'cors';
import { CommentRoute, CommentRouteValidator } from './routes/contact';
import axios from 'axios';

const server = `localhost:27017`;
const dbName = `blog`;
const draftCollectionName = `drafts`;
const publishCollectionName = `published`;
const client = new MongoClient(`mongodb://${server}`);

const apiPath = '/api';
const blogAPIPath = '/api/blog';
const blogAdminPostPath = '/api/blog/admin/post';

dotenv.config({ path: __dirname+'/.env' });

const blog = express();

blog.use(bodyParser.json());
blog.use(bodyParser.urlencoded({ extended: false }));
blog.use(cors())
blog.use(express.json());

//////////////////////// Auth //////////////////////////

blog.post(`${apiPath}/login`, loginRouteValidator, loginRoute(client));
blog.post(`${apiPath}/refreshToken`, authToken, refreshTokenRoute(client));

//////////////////////// BLOG //////////////////////////

blog.post(`${blogAdminPostPath}/draft/`, authToken, createDraftValidator, createDraftRoute(client));
blog.post(`${blogAdminPostPath}/draft/publish`, authToken, publishDraftValidator, publishDraftRoute(client));

blog.delete(`${blogAdminPostPath}/draft/delete/:id`, authToken, deleteDraftValidator, deleteDraftRoute(client));
blog.delete(`${blogAdminPostPath}/delete/:id`, authToken, deletePostValidator, deletePostRoute(client));
blog.delete(`${blogAdminPostPath}/draft/:id/body/delete/:collectionID`, authToken, deleteContentValidator, deleteContentRoute(client));

blog.put(`${blogAdminPostPath}/draft/:id/meta`, authToken, upsertDraftValidator, upsertDraftRoute(client));
//app.put(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID?`, authToken, upsertParagraphValidator, upsertParagraphRoute(client));

// app.post(`${blogAdminPostPath}/draft/:id/meta`, authToken, insertDraftValidator, insertDraftRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/meta`, authToken, updateDraftValidator, updateDraftRoute(client));
// app.put(`${blogAdminPostPath}/draft/:id/meta`, authToken, overrideDraftValidator, overrideDraftRoute(client));

blog.post(`${blogAdminPostPath}/draft/:id/body/paragraph/`, authToken, insertParagraphValidator, insertParagraphRoute(client));
blog.put(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID`, authToken, putParagraphValidator, putParagraphRoute(client));
blog.patch(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID`, authToken, patchParagraphValidator, patchParagraphRoute(client));

// app.post(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, insertImageValidator, insertImageRoute(client));
// app.put(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, updateImageValidator, updateImageRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, overrideImageValidator, overrideImageRoute(client));

// app.post(`${blogAdminPostPath}/draft/:id/body/code/:collectionID?`, authToken, insertCodeValidator, insertCodeRoute(client));
// app.put(`${blogAdminPostPath}/draft/:id/body/code/:collectionID?`, authToken, updateCodeValidator, updateCodeRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/body/code/:collectionID?`, authToken, overrideCodeValidator, overrideCodeRoute(client));

// app.patch(`${blogAdminPostPath}/draft/:id/body/move/:collectionID?`, authToken, moveContentValidator, moveContenthRoute(client));

blog.get(`${blogAdminPostPath}/draft/:id`, authToken, async (req: TypedRequest.RequestParams<{id: string}>, res: TypedRequest.Response<postContent.BlogPostDraft | string >) : Promise<any> => {
    const id = req.params.id;
    
    if (id.length !== 24) { res.status(400).send(`Draft ID must be a 24 character hex string`); return; }
    
    client.connect(async () => {
        const collection = client.db(dbName).collection(draftCollectionName);
        const query = { _id: new ObjectId(req.params.id) }
        const draft = await collection.findOne(query) as unknown as postContent.BlogPostDraft;

        if (!draft) { res.status(404).send('Could not find draft matching the provided ID'); return };

        res.send(draft);
    });
});

blog.get(`${blogAdminPostPath}/drafts`, authToken, async (req,res) => {
    client.connect(async () => {
        const collection = client.db(dbName).collection(draftCollectionName);
        const result = await collection.find().toArray();
        res.send( result );
    })
});

blog.get(`${blogAPIPath}/posts`, async (req, res) => {
    client.connect(async () => {
        const collection = client.db(dbName).collection(publishCollectionName);
        const result = await collection.find().toArray();
        res.send( result );
    })
});

//ToDo sanitize input
blog.get(`${blogAPIPath}/posts/:slug`, async (req, res) => {
    client.connect(async () => {
        const collection = client.db(dbName).collection(publishCollectionName);
        const result = await collection.find({slug: req.params.slug}).toArray();

        if (result.length === 0) 
            return res.sendStatus(404);

        return res.send( result[0] );
    })
})


////////////////////////// CAPTCHA ////////////////////////////

//TODO, install express-santizer and sanitize input
blog.post(`/api/contact`, captchaMiddleware, CommentRouteValidator, CommentRoute)

////////////////////////// SERVER ////////////////////////////

const port = process.env.PORT || 3000;
const expressServer = blog.listen(port, () => console.log(`Server running on port ${port}!`)); 

/////////// WEB SOCKETS!!! ////////////////


// const client_id = dotenv
// const client_secret = dotenv
// const redirect_uri = 'https://gravy.cc/'; // Your redirect uri

// let accessToken = dotenv
// const refreshToken = dotenv
// const exchangeCodeForAccessAndRefreshToken = async (code: string): Promise<any> => {
//     const params = new URLSearchParams();

//     params.append('client_id', client_id)
//     params.append('client_secret', client_secret)
//     params.append('grant_type', 'authorization_code');
//     params.append('code', code);
//     params.append('redirect_uri', redirect_uri)
    
//     const response = await axios({
//       url: 'https://accounts.spotify.com/api/token',
//       method: 'post',
//       params
//     });

//     const accessToken = response.data.access_token;
//     const refreshToken = response.data.refresh_token;

//     return {
//       accessToken: accessToken,
//       refreshToken: refreshToken
//     }
// }

// const WebSocket = require("ws");
// const wsServer = new WebSocket.Server({
//     noServer: true
// })  

// const getSpotify = async () => {
//     let response: any = null;

//     let headers = {
//         Authorization: `Bearer ${accessToken}`
//     }

//     try {
//         response = await axios.get("https://api.spotify.com/v1/me/player/currently-playing", {headers})
//     } catch (err: any) {
//         // console.log(err)
//         //If access-token is wrong then get a new one using the refresh token.
//         if (err.response && err.response.status === 401) {
//             const form = {
//                 grant_type: 'refresh_token',
//                 refresh_token: refreshToken,
//             }
//             const querystring = require('node:querystring');

//             const authOptions = {
//                 headers: { 
//                     'Authorization': 'Basic ' + (new Buffer(client_id + ':' + client_secret).toString('base64')),
//                     "content-Type": "application/x-www-form-urlencoded"
//                 }
//             }

//             const res = await axios.post(`https://accounts.spotify.com/api/token`, form, authOptions)
            
//             if (res.status === 200) {
//                 accessToken = res.data.access_token;
//                 headers = {
//                     Authorization: `Bearer ${accessToken}`
//                 }
//                 response = await axios.get("https://api.spotify.com/v1/me/player/currently-playing", {headers})
//             }
//         }
//     }

//     wsServer.clients.forEach((client:any) => {
//         client.send(JSON.stringify(response.data));
//     })
// }

// setInterval(async () => {
//     getSpotify();
// }, 5000)

// wsServer.on("connection", function(ws: any) {    // what should a websocket do on connection
//     console.log("Someone has loaded my website");
//     getSpotify();
//     ws.on("message", function(msg: any) {        // what to do on message event
//         wsServer.clients.forEach(function each(client: any) {
//             if (client.readyState === WebSocket.OPEN) {     // check if client is ready
//               client.send(msg.toString());
//             }
//         });
//     });
// });

const KUMA_KEY = dotenv.config({ path: __dirname+'/.env' }).parsed?.KUMA_KEY;

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
                console.log(err)
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

const WebSocket = require("ws");
const wsServer = new WebSocket.Server({
    server: expressServer,
    path: '/api/status'
    // noServer: true
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

    console.log(filtered)


    wsServer.clients.forEach((client:any) => {
        client.send(JSON.stringify(filtered));
    })
};

setInterval(async () => {
    getServiceStatus();
}, 5000)

wsServer.on("connection", function(ws: any) {    // what should a websocket do on connection
    console.log("Someone has loaded my website");
    getServiceStatus();
    ws.on("message", function(msg: any) {        // what to do on message event
        wsServer.clients.forEach(function each(client: any) {
            if (client.readyState === WebSocket.OPEN) {     // check if client is ready
                client.send(msg.toString());
            }
        });
    });
});