import { NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from "crypto";
import * as TypedRequest from '../../schema/TypedRequests';
import * as postContent from '../../schema/post';

const dbName = `blog`;
const draftCollectionName = `drafts`;

type reqItem = string | number | undefined;
type loginReqType = TypedRequest.Request<undefined, {css: reqItem, text: reqItem, position: reqItem}, {id: string | number} >;
type loginResType = TypedRequest.Response<any>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

export const insertParagraphRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
    return async (req: loginReqType, res: loginResType): Promise<any> => {  
        
        const position = res.locals.position;
        const css      = res.locals.css;
        const id       = res.locals.id
        const text     = res.locals.text;
        const collection = mongoClient.db(dbName).collection(draftCollectionName);
        const queryDraft = { _id: new ObjectId(id) }
        const contentID = new ObjectId(crypto.randomBytes(12).toString("hex"));
        
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

        if (position) 
            update.$push.content.$position = position

        const connection = await mongoClient.connect();
        const updateResponse = await collection.updateOne(queryDraft, update);
        if (updateResponse.matchedCount == 0)
            return res.status(404).send(`Draft with ID: ${id} could not be found`);

        return res.status(200).send({ contentID: contentID });
    };
};

export const insertParagraphValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
    const bodyTextUndefined = `Text Value was not defined. This is required when creating a new blog Element`;
    const cssIsNotAnObject = `The CSS Object provided was not an acceptable object`
    const invalidDraftID = `Draft ID must be a 24 character hex string`
    const positionIsNotNumber = `Position must be a number`

    const id = req.params.id + "";
    const css = safeJsonParse(req.body.css + "") as object | null;
    const position = req.body.position !== null && req.body.position !== undefined 
        ? parseInt(req.body.position as any) 
        : null;
    const text = req.body.text;

    if (id.length !== 24)                                               return res.status(400).send(invalidDraftID  ); 
    if (!text)                                                          return res.status(400).send(bodyTextUndefined ); 
    if (position !== null && position !== undefined && isNaN(position)) return res.status(400).send(positionIsNotNumber); 
    if (!css || css && Array.isArray(css))                              return res.status(400).send(cssIsNotAnObject);

    res.locals.id = id;
    res.locals.position = position;
    res.locals.css = css;
    res.locals.text = text;
    return next();
}

const safeJsonParse = (text: string): object | null => {
    try         { return JSON.parse(text); } 
    catch (err) { return null; }
}