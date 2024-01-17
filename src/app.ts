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
import { parse } from 'url';
import { generalSocketServer } from './sockets';
import { wsServerStatus } from './sockets/status';

const server = `192.168.20.20:27017`;
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

////////////////////////// Base ////////////////////////////
blog.get(`${apiPath}/`, (req, res) => {
    res.send('Hello World!');
});

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
    
    const connection = await client.connect();
    const collection = connection.db(dbName).collection(draftCollectionName);
    const query = { _id: new ObjectId(id) }
    const draft = await collection.findOne(query) as unknown as postContent.BlogPostDraft;

    if (!draft) { res.status(404).send('Could not find draft matching the provided ID'); return };

    res.send(draft);
});

blog.get(`${blogAdminPostPath}/drafts`, authToken, async (req,res) => {
    const connection = await client.connect();
    const collection = connection.db(dbName).collection(draftCollectionName);
    const result = await collection.find().toArray();
    res.send( result );
});

blog.get(`${blogAPIPath}/posts`, async (req, res) => {
    const connection = await client.connect();
    const collection = connection.db(dbName).collection(publishCollectionName);
    const result = await collection.find().toArray();
    res.send( result );
});

//ToDo sanitize input
blog.get(`${blogAPIPath}/posts/:slug`, async (req, res) => {
    const connection = await client.connect();
    const collection = connection.db(dbName).collection(publishCollectionName);
    const result = await collection.find({slug: req.params.slug}).toArray();

    if (result.length === 0) 
        return res.sendStatus(404);

    return res.send( result[0] );
})


////////////////////////// CAPTCHA ////////////////////////////

//TODO, install express-santizer and sanitize input
blog.post(`/api/contact`, captchaMiddleware, CommentRouteValidator, CommentRoute)

////////////////////////// SERVER ////////////////////////////

const port = process.env.PORT || 3000;
export const expressServer = blog.listen(port, () => console.log(`Server running on port ${port}!`)); 

expressServer.on('upgrade', (req, socket, head) => {
    const { pathname } = parse(req?.url ?? '');

    console.log('pathname: ', pathname)

    switch (pathname) {
        case '/api/socket':
            generalSocketServer.handleUpgrade(req, socket, head, (ws) => {
                generalSocketServer.emit('connection', ws, req);
            });
            break;
        case '/api/status':
            wsServerStatus.handleUpgrade(req, socket, head, (ws) => {
                wsServerStatus.emit('connection', ws, req);
            });
        default:
            socket.destroy();
    }
})