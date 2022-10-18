import { MongoClient, ObjectId } from 'mongodb';
import { loginRoute, loginRouteValidator } from './routes/login';
import { createDraftRoute, createDraftValidator } from './routes/createDraft';
import { deleteDraftRoute, deleteDraftValidator } from './routes/deleteDraft';
import { deletePostRoute, deletePostValidator } from './routes/deletePost';
import { authToken } from './middleware/authentication'
import express from 'express';
import bodyParser from 'body-parser';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import crypto from "crypto";
import * as postContent from './schema/post';
import * as TypedRequest from './schema/TypedRequests';
import { upsertDraftRoute, upsertDraftValidator } from './routes/upsertDraftMeta';
import { deleteContentRoute, deleteContentValidator } from './routes/paragraph/delete';
import { upsertParagraphRoute, upsertParagraphValidator } from './routes/paragraph/upsert';
import { publishDraftRoute, publishDraftValidator } from './routes/publishDraft';
import { insertParagraphRoute, insertParagraphValidator } from './routes/paragraph/insert';
import { putParagraphRoute, putParagraphValidator } from './routes/paragraph/override';
import { patchParagraphRoute, patchParagraphValidator } from './routes/paragraph/patch';
import cors from 'cors';

const server = `localhost:27017`;
const dbName = `blog`;
//const authDB = `auth`;
const draftCollectionName = `drafts`;
const publishCollectionName = `published`;
const client = new MongoClient(`mongodb://${server}`);

const apiPath = '/api';
const blogAPIPath = `${apiPath}/blog`;
const blogAdminPath = `${blogAPIPath}/admin`;
const blogAdminPostPath = `${blogAdminPath}/post`;

dotenv.config({ path: __dirname+'/.env' });

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(cors())

app.post(`${apiPath}/login`, loginRouteValidator, loginRoute(client));
app.post(`${blogAdminPostPath}/draft/`, authToken, createDraftValidator, createDraftRoute(client));
app.post(`${blogAdminPostPath}/draft/publish`, authToken, publishDraftValidator, publishDraftRoute(client));

app.delete(`${blogAdminPostPath}/draft/delete/:id`, authToken, deleteDraftValidator, deleteDraftRoute(client));
app.delete(`${blogAdminPostPath}/delete/:id`, authToken, deletePostValidator, deletePostRoute(client));
app.delete(`${blogAdminPostPath}/draft/:id/body/delete/:collectionID`, authToken, deleteContentValidator, deleteContentRoute(client));

app.put(`${blogAdminPostPath}/draft/:id/meta`, authToken, upsertDraftValidator, upsertDraftRoute(client));
//app.put(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID?`, authToken, upsertParagraphValidator, upsertParagraphRoute(client));


// app.post(`${blogAdminPostPath}/draft/:id/meta`, authToken, insertDraftValidator, insertDraftRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/meta`, authToken, updateDraftValidator, updateDraftRoute(client));
// app.put(`${blogAdminPostPath}/draft/:id/meta`, authToken, overrideDraftValidator, overrideDraftRoute(client));

app.post(`${blogAdminPostPath}/draft/:id/body/paragraph/`, authToken, insertParagraphValidator, insertParagraphRoute(client));
app.put(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID`, authToken, putParagraphValidator, putParagraphRoute(client));
app.patch(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID`, authToken, patchParagraphValidator, patchParagraphRoute(client));

// app.post(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, insertImageValidator, insertImageRoute(client));
// app.put(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, updateImageValidator, updateImageRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, overrideImageValidator, overrideImageRoute(client));

// app.post(`${blogAdminPostPath}/draft/:id/body/code/:collectionID?`, authToken, insertCodeValidator, insertCodeRoute(client));
// app.put(`${blogAdminPostPath}/draft/:id/body/code/:collectionID?`, authToken, updateCodeValidator, updateCodeRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/body/code/:collectionID?`, authToken, overrideCodeValidator, overrideCodeRoute(client));

// app.patch(`${blogAdminPostPath}/draft/:id/body/move/:collectionID?`, authToken, moveContentValidator, moveContenthRoute(client));




app.get(`${blogAdminPostPath}/draft/:id`, authToken, async (req: TypedRequest.RequestParams<{id: string}>, res: TypedRequest.Response<postContent.BlogPostDraft | string >) : Promise<any> => {
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

app.get(`${blogAdminPostPath}/drafts`, authToken, async (req,res) => {
    client.connect(async () => {
        const collection = client.db(dbName).collection(draftCollectionName);
        const result = await collection.find().toArray();
        res.send( result );
    })
});

app.get(`${blogAPIPath}/posts`, async (req, res) => {
    client.connect(async () => {
        const collection = client.db(dbName).collection(publishCollectionName);
        const result = await collection.find().toArray();
        res.send( result );
    })
});

//ToDo sanitize input
app.get(`${blogAPIPath}/posts/:slug`, async (req, res) => {
    client.connect(async () => {
        const collection = client.db(dbName).collection(publishCollectionName);
        const result = await collection.find({slug: req.params.slug}).toArray();
        res.send( result );
    })
})

app.listen(3000, () => console.log('blog server running on port 3000!')); 