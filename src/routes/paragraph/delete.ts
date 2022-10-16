import { NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import * as TypedRequest from '../../schema/TypedRequests';

const dbName = `blog`;
const draftCollectionName = `drafts`;

type loginReqType = TypedRequest.RequestParams<{collectionID: string, id: string}>;
type loginResType = TypedRequest.Response<string>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

export const deleteContentRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
    return async (req: loginReqType, res): Promise<any> => {        
        const collectionID = req.params?.collectionID;
        const id = req.params.id;
        const collection = mongoClient.db(dbName).collection(draftCollectionName);
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
    
        mongoClient.connect(async () => {
            const status = await collection.updateOne(query, update);
    
            return status.matchedCount === 0
                ? res.status(404).send("No content matching ID provided")
                : res.status(204).send();
        });
    };
};

export const deleteContentValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
    const collectionID = req.params?.collectionID;
    const id = req.params.id;

    if (id.length !== 24)           
        return res.status(400).send("Draft ID must be a 24 character hex string");
    if (collectionID.length !== 24) 
        return res.status(400).send("Collection ID must be a 24 character hex string");

    return next();
}