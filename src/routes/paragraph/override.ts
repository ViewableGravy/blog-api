import { NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from "crypto";
import * as TypedRequest from '../../schema/TypedRequests';
import * as postContent from '../../schema/post';
import { errorMessage } from '../../constants/errors';

const dbName = `blog`;
const draftCollectionName = `drafts`;

type reqItem = string | number | undefined;
type loginReqType = TypedRequest.Request<undefined, {css: reqItem, text: reqItem}, {id: string | number, collectionID: string | number} >;
type loginResType = TypedRequest.Response<any>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

//override
export const putParagraphRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
    return async (req: loginReqType, res: loginResType): Promise<any> => {  
        const css        = res.locals.css;
        const id         = res.locals.id
        const text       = res.locals.text;
        const contentID  = new ObjectId(res.locals.collectionID);
        const queryDraft = { _id: new ObjectId(id) }
        const collection = mongoClient.db(dbName).collection(draftCollectionName);
        
        const paragraphContent : Omit<postContent.BlogPostParagraph , "_id"> = {
            type: "Paragraph",
            text: text,
            css: css
        }
    
        const update : any = {
            $push: { 
                content: {
                    $each: [{
                        _id:  contentID,
                        ...paragraphContent
                    }],
                }
            }
        }

        const remove : any = {
            $pull: {
                content: {
                    _id: contentID
                }
            }
        };
    
        mongoClient.connect(async () => {       
            const removeResponse = await collection.updateOne(queryDraft, remove);
            if (removeResponse.matchedCount == 0)
                return res.status(404).send(`Draft with ID: ${id} could not be found`);

            const insertResponse = await collection.updateOne(queryDraft, update);
            if (insertResponse.matchedCount == 0)
                return res.status(404).send(`Draft with ID: ${id} could not be found`);
    
            return res.status(200).send({ contentID: contentID });
        });
    };
};

export const putParagraphValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
    const id = req.params.id + "";
    const css = safeJsonParse(req.body.css + "") as object | null;
    const text = req.body.text;
    const CollectionID = req.params.collectionID + "";
    const ObjectIDRegex = /^[0-9a-f]{24}$/i

    if (!id.match(ObjectIDRegex))           return res.status(400).send(errorMessage.invalidID('Draft ID')); 
    if (!CollectionID.match(ObjectIDRegex)) return res.status(400).send(errorMessage.invalidID('Collection ID')); 
    if (!text)                              return res.status(400).send(errorMessage.undefinedTextField);
    if (!css || css && Array.isArray(css))  return res.status(400).send(errorMessage.cssIsNotAnObject);

    res.locals.id = id;
    res.locals.css = css;
    res.locals.text = text;
    res.locals.collectionID = CollectionID;

    return next();
}

const safeJsonParse = (text: string): object | null => {
    try         { return JSON.parse(text); } 
    catch (err) { return null; }
}