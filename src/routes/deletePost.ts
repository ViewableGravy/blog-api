import { NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import * as TypedRequest from '../schema/TypedRequests';

const dbName = `blog`;
const publishCollectionName = `published`;

type loginReqType = TypedRequest.RequestParams<{id: string}>;
type loginResType = TypedRequest.Response<string>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

export const deletePostRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
    return async (req: loginReqType, res: loginResType) : Promise<any> => {
        const id = req.params.id;

        mongoClient.connect(async () => {
            const collection = mongoClient.db(dbName).collection(publishCollectionName);
            const query = { _id: new ObjectId(id) }
            const draft = await collection.deleteOne(query);
    
            if (draft.deletedCount === 0) return res.status(404).send('Could not find post matching the provided ID');
    
            return res.status(204).send();
        });
    };
};

export const deletePostValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
    return (!req.params.id || req.params.id.length !== 24)
        ? res.status(400).send(`Draft ID must be a 24 character hex string`)
        : next();
}