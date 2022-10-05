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


const generateCollectionInsertquery = (collectionID: string, position: number, existing: any, body: any, filteredKeys: (string)[]): object => {
    const insert: any = {
        $push: { 
            content: {
                $each: [existing?.content.find((x: any) => (x._id as ObjectId).toString() == collectionID)],
                $position: position
            }
        }
    }

    for (let key in body)
        if ( filteredKeys.includes(key) )
            insert.$push.content.$each[0][key] = (body)[key];

    return insert;
}

const generateCollectionFindQuery = (req: { params: { collectionID: string | null | undefined, id: string }}, contentType: string) => {
    const collectionID = req.params?.collectionID;
    const id = req.params.id;

    const query = !collectionID ? 
        { _id: new ObjectId(id) } : 
        { _id: new ObjectId(id), content: {
            $elemMatch: {
                _id: new ObjectId(collectionID),
                type: contentType
            } 
        }};

    return query
}

const GenerateCollectionUpsertQuery = (collectionID: string | null | null, body: {[key: string]: any}, position: number | null) => {
    //Insert new fields into collection element if collection is not specified
    if (!collectionID) {
        const createBodyElement: {$push: {content: any}} = {
            $push: { 
                content: {
                    $each: [{
                        _id:  new ObjectId(crypto.randomBytes(12).toString("hex")), //length 24 (since you can fit 2 hex in a byte I think)
                        ...body
                    }],
                }
            }
        }

        if (position !== null && !isNaN(position)) 
            createBodyElement.$push.content['$position'] = position

        return createBodyElement;
    } 
    
    //Update existing collection with keys if collectionID is defined
    const updateBodyElement: {$set: any} = { $set: {} }

    for (let key in body)
        if (body[key])
            updateBodyElement.$set[`content.$.${key}`] = body[key]

    return updateBodyElement;
}

const moveContent = async (res: any, req: any, query: object, filteredKeys: (string)[]) => {
    const collection = client.db(dbName).collection(draftCollectionName);
    const collectionID = req.params?.collectionID;
    const id = req.params.id;
    const position = parseInt(req.body.position) 

    //get existing content
    const find = await collection.findOne(query)
    if (!find) { res.status(404).send(`Content with Collection Id does not exist`); return };

    //remove existing content
    const remove = await collection.updateOne(query, {
        $pull: {
            content: {
                _id: new ObjectId(collectionID)
            }
        }
    });

    if (remove.matchedCount == 0) { res.status(400).send(`Failed to remove element from content`); return }

    const insertObject = generateCollectionInsertquery(collectionID, position, find, req.body, filteredKeys)
    const insertResponse = await collection.updateOne({ _id: new ObjectId(id) }, insertObject);

    res.status(200).send({
        inserted: (insertObject as any).$push.content.$each,
        position: position
    });
}

const draftContentHelperFunctions = {
    generateCollectionInsertquery: generateCollectionInsertquery,
    generateCollectionFindQuery: generateCollectionFindQuery,
    GenerateCollectionUpsertQuery: GenerateCollectionUpsertQuery,
    moveContent: moveContent
}

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

app.post  (`${apiPath}/login`, loginRouteValidator, loginRoute(client));
app.post  (`${blogAdminPostPath}/draft/`, authToken, createDraftValidator, createDraftRoute(client));
app.delete(`${blogAdminPostPath}/draft/delete/:id`, authToken, deleteDraftValidator, deleteDraftRoute(client));
app.delete(`${blogAdminPostPath}/delete/:id`, authToken, deletePostValidator, deletePostRoute(client));

// create POST (insert/override) / PUT (update)
app.put(`${blogAdminPostPath}/draft/:id/meta`, authToken, upsertDraftValidator, upsertDraftRoute(client));

app.post(`${blogAdminPostPath}/draft/:id/body/delete`, authToken, async (req: TypedRequest.Request<undefined, {collectionID: string | null}, {id: string}>, res) => {
    const invalidDraftID = `Draft ID must be a 24 character hex string`;
    const invalidCollectionID = `Draft ID must be a 24 character hex string`;
    
    const collectionID = req.body?.collectionID ?? "";
    const id = req.params.id;

    if (id.length !== 24)           { res.status(400).send(invalidDraftID     ); return }
    if (collectionID.length !== 24) { res.status(400).send(invalidCollectionID); return }

    const collection = client.db(dbName).collection(draftCollectionName);
    const query = { 
        _id: new ObjectId(id), 
        content: {
            $elemMatch: {
                _id: new ObjectId(collectionID)
            } 
        }
    };
    const update = { 
        $pull: {
            content: {
                _id: new ObjectId(collectionID)
            }
        }
    }

    client.connect(async () => {
        const status = await collection.updateOne(query, update);

        if (status.matchedCount === 0) { res.status(404).send("No content matching ID provided"); return; }
        res.status(204).send();
    });
});

//Allow a body element to be re-ordered (e.g. place an image at the top rather than bottom)
app.post(`${blogAdminPostPath}/draft/:id/body/re-order`, authToken, async (req, res) => {

});

app.post(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID?`, authToken, async (req: TypedRequest.Request<undefined, {css: string, text: string, position: string | number | undefined}, {id: string, collectionID: string | null} >, res) => {  
    const bodyTextUndefined = `Text Value was not defined. This is required when creating a new blog Element of type Paragraph`;
    const cssIsNotAnObject = `The CSS Object provided was not an acceptable object`
    const invalidDraftID = `Draft ID must be a 24 character hex string`
    const invalidCollectionID = `Draft ID must be a 24 character hex string`
    const positionIsNotNumber = `Position must be a number`

    const id = req.params.id;
    const position = req.body.position !== null && req.body.position !== undefined 
        ? parseInt(req.body.position as any) 
        : null;
    const collectionID = req.params?.collectionID ?? null;

    if (id.length !== 24)                                                { res.status(400).send(invalidDraftID     ); return }
    if (collectionID && collectionID.length !== 24)                      { res.status(400).send(invalidCollectionID); return }
    if (!req.body.text && !req.params.collectionID)                      { res.status(400).send(bodyTextUndefined  ); return }
    if (position !== null && position !== undefined && isNaN(position))  { res.status(400).send(positionIsNotNumber); return }
    
    let css: { [key: string]: any} = {};
    if (req.body.css)
        try { css = JSON.parse(req.body.css); } catch { res.status(400).send(cssIsNotAnObject); return }
        
    if (req.body.css && Array.isArray(css))           { res.status(400).send(cssIsNotAnObject); return }
    
    const collection = client.db(dbName).collection(draftCollectionName);
    const findQuery = generateCollectionFindQuery(req, "Paragraph");
    
    //only add css if not an empty object.
    const paragraphContent : Omit<postContent.BlogPostParagraph , "_id"> = {
        type: "Paragraph",
        text: req.body.text,
        css: css
    }

    const update = GenerateCollectionUpsertQuery(collectionID, paragraphContent, position)

    client.connect(async () => {
        // updating existing content with a new position
        if (collectionID && position)
            return await draftContentHelperFunctions.moveContent(res, req, findQuery, ['css', 'text']);

        // upsert (no rearrange) / insert with position
        const findResponse = await collection.findOne(findQuery);
        if (!findResponse) { res.status(404).send(`Content with CollectionID ${collectionID} does not exist`); return };

        const update = draftContentHelperFunctions.GenerateCollectionUpsertQuery(collectionID, paragraphContent, position)
        const updateResponse = await collection.updateOne(findQuery, update, { upsert: true });

        if (!updateResponse.acknowledged) return res.status(500).send('An error occured with inserting into the database');

        //No collection id, one was generated in the update object
        !collectionID
            ? res.status(200).send((update as any).$push.content.$each[0]._id)
            : res.status(200).send(paragraphContent);
    });
});

app.post(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, async (req: TypedRequest.Request<undefined, {css: string, path: string, position: string | undefined}, { id: string, collectionID: string | null }>,res) => {
    const imagePathNotDefined = `path value was not defined. This is required when creating a new blog Element of type "image"`
    const cssIsNotAnObject    = `The CSS Object provided was not an acceptable object`
    const invalidID           = `ID must be a 24 character hex string`
    const invalidCollectionID = `Draft ID must be a 24 character hex string`
    const positionIsNotNumber = `Position must be a number`

    const type = "Image";
    const id = req.params.id;
    const position = req.body.position !== null && req.body.position !== undefined 
        ? parseInt(req.body.position) 
        : null;
    const collectionID = req.params?.collectionID ?? null;

    let css: { [key: string]: any} = {};
    if (req.body.css)
        try   { css = JSON.parse(req.body.css); } 
        catch { return res.status(400).send(cssIsNotAnObject) }

    if (id.length !== 24)                                               return res.status(400).send(invalidID          );
    if (collectionID && collectionID.length !== 24)                     return res.status(400).send(invalidCollectionID);
    if (!req.body.path && !req.params.collectionID)                     return res.status(400).send(imagePathNotDefined);
    if (position !== null && position !== undefined && isNaN(position)) return res.status(400).send(positionIsNotNumber);
    if (req.body.css && Array.isArray(css))                             return res.status(400).send(cssIsNotAnObject   );

    const findQuery = draftContentHelperFunctions.generateCollectionFindQuery(req, type);
    const collection = client.db(dbName).collection(draftCollectionName);
    const imageContent: Omit<postContent.BlogPostImage, "_id"> = {
        type: type,
        path: req.body.path,
        css: css
    }

    client.connect(async () => {
        // updating existing content with a new position
        if (collectionID && position)
            return await draftContentHelperFunctions.moveContent(res, req, findQuery, ['css', 'path']);
        
        // upsert (no rearrange) / insert with position
        const findResponse = await collection.findOne(findQuery);
        if (!findResponse) { res.status(404).send(`Content with CollectionID ${collectionID} does not exist`); return };

        const update = draftContentHelperFunctions.GenerateCollectionUpsertQuery(collectionID, imageContent, position)
        const updateResponse = await collection.updateOne(findQuery, update, { upsert: true });

        if (!updateResponse.acknowledged) return res.status(500).send('An error occured with inserting into the database');

        //No collection id, one was generated in the update object
        !collectionID
            ? res.status(200).send((update as any).$push.content.$each[0]._id)
            : res.status(200).send(imageContent);
    });
});

app.post(`${blogAdminPostPath}/draft/:id/body/Code`, authToken, async (req,res) => {
    //TODO
});

app.post(`${blogAdminPostPath}/draft/publish`, authToken, async (req: TypedRequest.RequestBody<{draftID: string | undefined}>, res) => {
    const draftID = req.body?.draftID;

    if (!draftID)              { res.status(400).send(`Must provide a draftID`); return }
    if (draftID.length !== 24) { res.status(400).send(`Invalid draftID`       ); return }

    client.connect(async () => {
        const draftCollection = client.db(dbName).collection(draftCollectionName);
        const publishCollection = client.db(dbName).collection(publishCollectionName);

        const query = { _id: new ObjectId(draftID) };
        const draft = await draftCollection.findOne(query) as unknown as postContent.BlogPostDraft;
            
        if (!draft)                     { res.status(404).send(`Could not find draft with ID: ${draftID}`); return }
        if (!draft?.title)              { res.status(400).send(`Title on draft was not defined`          ); return }
        if (!draft?.summary)            { res.status(400).send(`summary on draft was not defined`        ); return }
        if (!draft?.author)             { res.status(400).send(`author on draft was not defined`         ); return }
        if (!draft?.date)               { res.status(400).send(`date on draft was not defined`           ); return }
        if (draft.content.length === 0) { res.status(400).send(`No content was specified for draft`      ); return }

        const post : Omit<postContent.BlogPostProduction, "_id"> = {
            content: draft.content,
            title: draft.title,
            summary: draft.summary,
            author: draft.author,
            date: draft.date
        }

        const creationResponse = draft?.postID 
            ? await publishCollection.replaceOne({_id: new ObjectId(draft.postID)}, post)
            : await publishCollection.insertOne(post);

        if (!creationResponse.acknowledged) { res.status(500).send('Database didn\'t acknowledge transaction'); return }
        
        await draftCollection.deleteOne({_id: new ObjectId(draftID)});
            
        res.status(201).send({postID: draft?.postID ?? creationResponse.insertedId})
    });
});

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

//testing
app.get(`${blogAPIPath}/posts`, async (req, res) => {
    client.connect(async () => {
        const collection = client.db(dbName).collection(publishCollectionName);
        const result = await collection.find().toArray();
        res.send( result );
    })
});

app.listen(3000, () => console.log('blog server running on port 3000!')); 