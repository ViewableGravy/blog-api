import { NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import * as TypedRequest from '../schema/TypedRequests';
import * as postContent from '../schema/post';

const dbName = `blog`;
const draftCollectionName = `drafts`;
const publishCollectionName = `published`;

type loginReqType = TypedRequest.RequestBody<{postID: string}>;
type loginResType = TypedRequest.Response<{draftID: string} | string>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

export const createDraftRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
    return async (req: loginReqType, res: loginResType) : Promise<any> => {
        const postID = req.body?.postID ?? undefined;

        mongoClient.connect(async () => {
            const draftCollection = mongoClient.db(dbName).collection(draftCollectionName);
            const publishCollection = mongoClient.db(dbName).collection(publishCollectionName);

            const query = { _id: new ObjectId(postID) }

            //only query database if a postID was provided
            const publishedPost = postID 
                ? await publishCollection.findOne(query) as unknown as postContent.BlogPostProduction
                : undefined;

            if (postID && !publishedPost) return res.status(404).send(`Post does not exist`);

            const newDraft: postContent.BlogPostDraft | any = {
                content: publishedPost?.content ?? [],
                title: publishedPost?.title ?? undefined,
                summary: publishedPost?.summary ?? undefined,
                author: publishedPost?.author ?? undefined,
                date: publishedPost?.date ?? undefined,
                postID: postID
            }

            const creationResponse = await draftCollection.insertOne(newDraft);
            if (!creationResponse.acknowledged) return res.status(500).send('An error occured with inserting into the database');
            
            const insertedID = creationResponse.insertedId; //assuming this is always a 
            if (!insertedID || !insertedID && typeof insertedID !== 'string') return res.status(400).send(`Document ID was not returned, instead got ${insertedID}`);

            res.status(201).send({draftID: insertedID.toString()})
        });
    }
};

export const createDraftValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
    if (req.body?.postID && req.body?.postID.length !== 24) return res.status(400).send("postID must be a 24 character string");
    return next();
}