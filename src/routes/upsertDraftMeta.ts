import { NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import * as TypedRequest from '../schema/TypedRequests';
import * as postContent from '../schema/post';

const dbName = `blog`;
const draftCollectionName = `drafts`;

type loginReqType = TypedRequest.Request<undefined, postContent.BlogPostMeta, {id: string}>;
type loginResType = TypedRequest.Response<string>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

//verify that tags are arrays of strings
export const upsertDraftRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
    return async (req: loginReqType, res: loginResType): Promise<any> => {
        const id = req.params.id;
        const updateData: any = {};
    
        if (id.length !== 24) return res.status(400).send(`Draft ID must be a 24 character hex string`);
        if (req.body?.author) updateData["author"] = req.body?.author;
        if (req.body?.title) updateData["title"] = req.body?.title;
        if (req.body?.summary) updateData["summary"] = req.body?.summary;
        if (req.body?.date) updateData["date"] = req.body?.date;
        if (req.body?.slug) updateData["slug"] = req.body?.slug;
        if (req.body?.tags) updateData["tags"] = req.body?.tags;
        if (Object.keys(updateData).length == 0) return res.status(400).send("Bad Request: Must include body");
    
        mongoClient.connect(async () => {
            const query = { _id: new ObjectId(req.params.id) };
            const update = { $set: updateData }
            const options = { upsert: true }
            const collection = mongoClient.db(dbName).collection(draftCollectionName);
            
            const updateResponse = await collection.updateOne(query, update, options);
            if (!updateResponse.acknowledged) return res.status(500).send('An error occured with inserting into the database');
    
            //if upsert return 201 else 204 no content
            return res.status(204).send();
        });
    };
};

export const upsertDraftValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
    const id = req.params.id;

    if (id.length !== 24) return res.status(400).send(`Draft ID must be a 24 character hex string`);
    if ( !("author" in req.body) 
      && !("title" in req.body) 
      && !("summary" in req.body) 
      && !("date" in req.body)
      && !("slug" in req.body) 
      && !("tags" in req.body) ) return res.status(400).send("Bad Request: Must include body"); 

    return next();
}