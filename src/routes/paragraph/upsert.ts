import { NextFunction } from 'express';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from "crypto";
import * as TypedRequest from '../../schema/TypedRequests';
import * as postContent from '../../schema/post';

const dbName = `blog`;
const draftCollectionName = `drafts`;
const publishCollectionName = `published`;

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

const moveContent = (mongoClient: MongoClient): any => {
    return async (res: any, req: any, query: object, filteredKeys: (string)[]) => {
        const collection = mongoClient.db(dbName).collection(draftCollectionName);
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
}

const draftContentHelperFunctions = {
    generateCollectionInsertquery: generateCollectionInsertquery,
    generateCollectionFindQuery: generateCollectionFindQuery,
    GenerateCollectionUpsertQuery: GenerateCollectionUpsertQuery,
    moveContent: moveContent
}

type loginReqType = TypedRequest.Request<undefined, {css: string, text: string, position: string | number | undefined}, {id: string, collectionID: string | null} >;
type loginResType = TypedRequest.Response<any>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

export const upsertParagraphRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
    return async (req: loginReqType, res: loginResType): Promise<any> => {  
        
        const position = res.locals.position;
        const css = res.locals.css;
        const collectionID = res.locals.collectionID;
        const collection = mongoClient.db(dbName).collection(draftCollectionName);

        const findQuery = generateCollectionFindQuery(req, "Paragraph");
        
        //only add css if not an empty object.
        const paragraphContent : Omit<postContent.BlogPostParagraph , "_id"> = {
            type: "Paragraph",
            text: req.body.text,
            css: css
        }
    
        const update = GenerateCollectionUpsertQuery(collectionID, paragraphContent, position)
    
        mongoClient.connect(async () => {
            // updating existing content with a new position
            if (collectionID && position)
                return await draftContentHelperFunctions.moveContent(mongoClient)(res, req, findQuery, ['css', 'text']);
    
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
    };
};

export const upsertParagraphValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
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

    if (id.length !== 24)                                                return res.status(400).send(invalidDraftID     );
    if (collectionID && collectionID.length !== 24)                      return res.status(400).send(invalidCollectionID); 
    if (!req.body.text && !req.params.collectionID)                      return res.status(400).send(bodyTextUndefined  ); 
    if (position !== null && position !== undefined && isNaN(position))  return res.status(400).send(positionIsNotNumber); 
    
    let css: { [key: string]: any} = {};
    if (req.body.css)
        try { css = JSON.parse(req.body.css); } catch { return res.status(400).send(cssIsNotAnObject); }
        
    if (req.body.css && Array.isArray(css)) return res.status(400).send(cssIsNotAnObject);

    res.locals.id = id;
    res.locals.position = position;
    res.locals.css = css;
    res.locals.collectionID = collectionID;
    return next();
}

