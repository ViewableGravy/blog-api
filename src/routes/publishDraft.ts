import { NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import * as TypedRequest from '../schema/TypedRequests';
import * as postContent from '../schema/post';

const dbName = `blog`;
const draftCollectionName = `drafts`;
const publishCollectionName = `published`;

type loginReqType = TypedRequest.RequestBody<{draftID: string | undefined}>;
type loginResType = TypedRequest.Response<any>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

export const publishDraftRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
    return async (req: loginReqType, res: loginResType): Promise<any> => {
        const draftID = req.body?.draftID;
    
        mongoClient.connect(async () => {
            const draftCollection = mongoClient.db(dbName).collection(draftCollectionName);
            const publishCollection = mongoClient.db(dbName).collection(publishCollectionName);
    
            const query = { _id: new ObjectId(draftID) };
            const draft = await draftCollection.findOne(query) as unknown as postContent.BlogPostDraft;
                
            if (!draft)                     return res.status(404).send(`Could not find draft with ID: ${draftID}`);
            if (!draft?.title)              return res.status(400).send(`Title on draft was not defined`          );
            if (!draft?.summary)            return res.status(400).send(`summary on draft was not defined`        );
            if (!draft?.author)             return res.status(400).send(`author on draft was not defined`         );
            if (!draft?.date)               return res.status(400).send(`date on draft was not defined`           );
            if (!draft?.slug)               return res.status(400).send(`slug on draft was not defined`           );
            if (!draft?.tags)               return res.status(400).send(`No Tags on draft were defined`           );
            if (draft.content.length === 0) return res.status(400).send(`No content was specified for draft`      );
    
            const post : Omit<postContent.BlogPostProduction, "_id"> = {
                content: draft.content,
                title: draft.title,
                summary: draft.summary,
                author: draft.author,
                date: draft.date,
                slug: draft.slug,
                tags: draft.tags
            }
    
            const creationResponse = draft?.postID 
                ? await publishCollection.replaceOne({_id: new ObjectId(draft.postID)}, post)
                : await publishCollection.insertOne(post);
    
            if (!creationResponse.acknowledged) { res.status(500).send(`Database didn't acknowledge transaction`); return }
            
            await draftCollection.deleteOne({_id: new ObjectId(draftID)});
                
            res.status(201).send({postID: draft?.postID ?? creationResponse.insertedId})
        });
    };
};

export const publishDraftValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
    const id = req.body.draftID;

    if (!id)              return res.status(400).send(`Draft ID Must be defined`)
    if (id.length !== 24) return res.status(400).send(`Draft ID must be a 24 character hex string`);

    return next();
}