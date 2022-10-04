"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mongodb_1 = require("mongodb");
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const crypto_1 = __importDefault(require("crypto"));
const generateCollectionInsertquery = (collectionID, position, existing, body, filteredKeys) => {
    const insert = {
        $push: {
            content: {
                $each: [existing === null || existing === void 0 ? void 0 : existing.content.find((x) => x._id.toString() == collectionID)],
                $position: position
            }
        }
    };
    for (let key in body)
        if (filteredKeys.includes(key))
            insert.$push.content.$each[0][key] = (body)[key];
    return insert;
};
const generateCollectionFindQuery = (req, contentType) => {
    var _a;
    const collectionID = (_a = req.params) === null || _a === void 0 ? void 0 : _a.collectionID;
    const id = req.params.id;
    const query = !collectionID ?
        { _id: new mongodb_1.ObjectId(id) } :
        { _id: new mongodb_1.ObjectId(id), content: {
                $elemMatch: {
                    _id: new mongodb_1.ObjectId(collectionID),
                    type: contentType
                }
            } };
    return query;
};
const GenerateCollectionUpsertQuery = (collectionID, body, position) => {
    //Insert new fields into collection element if collection is not specified
    if (!collectionID) {
        const createBodyElement = {
            $push: {
                content: {
                    $each: [{
                            _id: new mongodb_1.ObjectId(crypto_1.default.randomBytes(12).toString("hex")),
                            ...body
                        }],
                }
            }
        };
        if (position !== null && !isNaN(position))
            createBodyElement.$push.content['$position'] = position;
        return createBodyElement;
    }
    //Update existing collection with keys if collectionID is defined
    const updateBodyElement = { $set: {} };
    for (let key in body)
        if (body[key])
            updateBodyElement.$set[`content.$.${key}`] = body[key];
    return updateBodyElement;
};
const moveContent = async (res, req, query, filteredKeys) => {
    var _a;
    const collection = client.db(dbName).collection(draftCollectionName);
    const collectionID = (_a = req.params) === null || _a === void 0 ? void 0 : _a.collectionID;
    const id = req.params.id;
    const position = parseInt(req.body.position);
    //get existing content
    const find = await collection.findOne(query);
    if (!find) {
        res.status(404).send(`Content with Collection Id does not exist`);
        return;
    }
    ;
    //remove existing content
    const remove = await collection.updateOne(query, {
        $pull: {
            content: {
                _id: new mongodb_1.ObjectId(collectionID)
            }
        }
    });
    if (remove.matchedCount == 0) {
        res.status(400).send(`Failed to remove element from content`);
        return;
    }
    const insertObject = generateCollectionInsertquery(collectionID, position, find, req.body, filteredKeys);
    const insertResponse = await collection.updateOne({ _id: new mongodb_1.ObjectId(id) }, insertObject);
    res.status(200).send({
        inserted: insertObject.$push.content.$each,
        position: position
    });
};
const draftContentHelperFunctions = {
    generateCollectionInsertquery: generateCollectionInsertquery,
    generateCollectionFindQuery: generateCollectionFindQuery,
    GenerateCollectionUpsertQuery: GenerateCollectionUpsertQuery,
    moveContent: moveContent
};
const server = `localhost:27017`;
const dbName = `blog`;
const authDB = `auth`;
const draftCollectionName = `drafts`;
const publishCollectionName = `published`;
const client = new mongodb_1.MongoClient(`mongodb://${server}`);
const apiPath = '/api';
const blogAPIPath = `${apiPath}/blog`;
const blogAdminPath = `${blogAPIPath}/admin`;
const blogAdminPostPath = `${blogAPIPath}/post`;
dotenv_1.default.config({ path: __dirname + '/.env' });
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: false }));
const generateAccessToken = (username) => {
    if (!process.env.TOKEN_SECRET)
        throw new TypeError;
    return jsonwebtoken_1.default.sign(username, process.env.TOKEN_SECRET, { expiresIn: '3600s' });
};
const authToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null)
        return res.sendStatus(401);
    jsonwebtoken_1.default.verify(token, process.env.TOKEN_SECRET, (err, user) => {
        if (err)
            return res.sendStatus(403);
        req.user = user;
        next();
    });
};
app.post(`${apiPath}/login`, (req, res) => {
    var _a, _b, _c, _d;
    const message = `connected successfully with username: ${req.body.username} and password: ${req.body.password}`;
    if (!((_a = req.body) === null || _a === void 0 ? void 0 : _a.username)) {
        res.status(400).send("Username is not defined");
        return;
    }
    else if (!((_b = req.body) === null || _b === void 0 ? void 0 : _b.password)) {
        res.status(400).send("Password is not defined");
        return;
    }
    const user = {
        username: (_c = req.body) === null || _c === void 0 ? void 0 : _c.username,
        password: (_d = req.body) === null || _d === void 0 ? void 0 : _d.password,
        name: undefined
    };
    client.connect(async () => {
        const collection = client.db(authDB).collection(authDB);
        const dbUser = await collection.findOne({ username: user.username });
        if (!dbUser) {
            res.status(401).send(`user not found ${user.username}`);
            return;
        }
        if (dbUser.password != user.password) {
            res.status(401).send(`Authentication Failed`);
            return;
        }
        res.status(200).send({
            message: `successfully logged in as ${dbUser.username}`,
            access_token: generateAccessToken({ username: user.username })
        });
    });
});
app.post(`${blogAdminPostPath}/draft/`, authToken, async (req, res) => {
    var _a, _b;
    //const draftID = randomUUID();
    const postID = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.postID) !== null && _b !== void 0 ? _b : undefined;
    client.connect(async () => {
        var _a, _b, _c, _d, _e;
        const draftCollection = client.db(dbName).collection(draftCollectionName);
        const publishCollection = client.db(dbName).collection(publishCollectionName);
        const query = { _id: new mongodb_1.ObjectId(postID) };
        //only query database if a postID was provided
        const publishedPost = postID
            ? await publishCollection.findOne(query)
            : undefined;
        if (postID && !publishedPost) {
            res.status(404).send(`Post does not exist`);
            return;
        }
        const newDraft = {
            content: (_a = publishedPost === null || publishedPost === void 0 ? void 0 : publishedPost.content) !== null && _a !== void 0 ? _a : [],
            title: (_b = publishedPost === null || publishedPost === void 0 ? void 0 : publishedPost.title) !== null && _b !== void 0 ? _b : undefined,
            summary: (_c = publishedPost === null || publishedPost === void 0 ? void 0 : publishedPost.summary) !== null && _c !== void 0 ? _c : undefined,
            author: (_d = publishedPost === null || publishedPost === void 0 ? void 0 : publishedPost.author) !== null && _d !== void 0 ? _d : undefined,
            date: (_e = publishedPost === null || publishedPost === void 0 ? void 0 : publishedPost.date) !== null && _e !== void 0 ? _e : undefined,
            postID: postID
        };
        const creationResponse = await draftCollection.insertOne(newDraft);
        if (!creationResponse.acknowledged) {
            res.status(500).send('An error occured with inserting into the database');
            return;
        }
        const insertedID = creationResponse.insertedId; //assuming this is always a 
        if (!insertedID || !insertedID && typeof insertedID !== 'string') {
            res.status(400).send(`Document ID was not returned, instead got ${insertedID}`);
            return;
        }
        res.status(201).send({ draftID: insertedID.toString() });
    });
});
app.post(`${blogAdminPostPath}/draft/delete`, authToken, async (req, res) => {
    const id = req.body.draftID;
    if (id.length !== 24) {
        res.status(400).send(`Draft ID must be a 24 character hex string`);
        return;
    }
    client.connect(async () => {
        const collection = client.db(dbName).collection(draftCollectionName);
        const query = { _id: new mongodb_1.ObjectId(id) };
        const draft = await collection.deleteOne(query);
        if (draft.deletedCount === 0) {
            res.status(404).send('Could not find draft matching the provided ID');
            return;
        }
        ;
        res.status(204).send();
    });
});
app.post(`${blogAdminPostPath}/delete`, authToken, async (req, res) => {
    const id = req.body.postID;
    if (id.length !== 24) {
        res.status(400).send(`Post ID must be a 24 character hex string`);
        return;
    }
    client.connect(async () => {
        const collection = client.db(dbName).collection(publishCollectionName);
        const query = { _id: new mongodb_1.ObjectId(id) };
        const draft = await collection.deleteOne(query);
        if (draft.deletedCount === 0) {
            res.status(404).send('Could not find post matching the provided ID');
            return;
        }
        ;
        res.status(204).send();
    });
});
app.post(`${blogAdminPostPath}/draft/:id/meta`, authToken, async (req, res) => {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const id = req.params.id;
    const updateData = {};
    if (id.length !== 24) {
        res.status(400).send(`Draft ID must be a 24 character hex string`);
        return;
    }
    if ((_a = req.body) === null || _a === void 0 ? void 0 : _a.author)
        updateData["author"] = (_b = req.body) === null || _b === void 0 ? void 0 : _b.author;
    if ((_c = req.body) === null || _c === void 0 ? void 0 : _c.title)
        updateData["title"] = (_d = req.body) === null || _d === void 0 ? void 0 : _d.title;
    if ((_e = req.body) === null || _e === void 0 ? void 0 : _e.summary)
        updateData["summary"] = (_f = req.body) === null || _f === void 0 ? void 0 : _f.summary;
    if ((_g = req.body) === null || _g === void 0 ? void 0 : _g.date)
        updateData["date"] = (_h = req.body) === null || _h === void 0 ? void 0 : _h.date;
    if (Object.keys(updateData).length == 0) {
        res.status(400).send("Bad Request: Must include body");
        return;
    }
    client.connect(async () => {
        const query = { _id: new mongodb_1.ObjectId(req.params.id) };
        const update = { $set: updateData };
        const options = { upsert: true };
        const collection = client.db(dbName).collection(draftCollectionName);
        const updateResponse = await collection.updateOne(query, update, options);
        if (!updateResponse.acknowledged) {
            res.status(500).send('An error occured with inserting into the database');
            return;
        }
        //if upsert return 201 else 204 no content
        res.status(204).send();
    });
});
app.post(`${blogAdminPostPath}/draft/:id/body/delete`, authToken, async (req, res) => {
    var _a, _b;
    const invalidDraftID = `Draft ID must be a 24 character hex string`;
    const invalidCollectionID = `Draft ID must be a 24 character hex string`;
    const collectionID = (_b = (_a = req.body) === null || _a === void 0 ? void 0 : _a.collectionID) !== null && _b !== void 0 ? _b : "";
    const id = req.params.id;
    if (id.length !== 24) {
        res.status(400).send(invalidDraftID);
        return;
    }
    if (collectionID.length !== 24) {
        res.status(400).send(invalidCollectionID);
        return;
    }
    const collection = client.db(dbName).collection(draftCollectionName);
    const query = {
        _id: new mongodb_1.ObjectId(id),
        content: {
            $elemMatch: {
                _id: new mongodb_1.ObjectId(collectionID)
            }
        }
    };
    const update = {
        $pull: {
            content: {
                _id: new mongodb_1.ObjectId(collectionID)
            }
        }
    };
    client.connect(async () => {
        const status = await collection.updateOne(query, update);
        if (status.matchedCount === 0) {
            res.status(404).send("No content matching ID provided");
            return;
        }
        res.status(204).send();
    });
});
//Allow a body element to be re-ordered (e.g. place an image at the top rather than bottom)
app.post(`${blogAdminPostPath}/draft/:id/body/re-order`, authToken, async (req, res) => {
});
app.post(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID?`, authToken, async (req, res) => {
    var _a, _b;
    const bodyTextUndefined = `Text Value was not defined. This is required when creating a new blog Element of type Paragraph`;
    const cssIsNotAnObject = `The CSS Object provided was not an acceptable object`;
    const invalidDraftID = `Draft ID must be a 24 character hex string`;
    const invalidCollectionID = `Draft ID must be a 24 character hex string`;
    const positionIsNotNumber = `Position must be a number`;
    const id = req.params.id;
    const position = req.body.position !== null && req.body.position !== undefined
        ? parseInt(req.body.position)
        : null;
    const collectionID = (_b = (_a = req.params) === null || _a === void 0 ? void 0 : _a.collectionID) !== null && _b !== void 0 ? _b : null;
    if (id.length !== 24) {
        res.status(400).send(invalidDraftID);
        return;
    }
    if (collectionID && collectionID.length !== 24) {
        res.status(400).send(invalidCollectionID);
        return;
    }
    if (!req.body.text && !req.params.collectionID) {
        res.status(400).send(bodyTextUndefined);
        return;
    }
    if (position !== null && position !== undefined && isNaN(position)) {
        res.status(400).send(positionIsNotNumber);
        return;
    }
    let css = {};
    if (req.body.css)
        try {
            css = JSON.parse(req.body.css);
        }
        catch {
            res.status(400).send(cssIsNotAnObject);
            return;
        }
    if (req.body.css && Array.isArray(css)) {
        res.status(400).send(cssIsNotAnObject);
        return;
    }
    const collection = client.db(dbName).collection(draftCollectionName);
    const findQuery = generateCollectionFindQuery(req, "Paragraph");
    //only add css if not an empty object.
    const paragraphContent = {
        type: "Paragraph",
        text: req.body.text,
        css: css
    };
    const update = GenerateCollectionUpsertQuery(collectionID, paragraphContent, position);
    client.connect(async () => {
        // updating existing content with a new position
        if (collectionID && position)
            return await draftContentHelperFunctions.moveContent(res, req, findQuery, ['css', 'text']);
        // upsert (no rearrange) / insert with position
        const findResponse = await collection.findOne(findQuery);
        if (!findResponse) {
            res.status(404).send(`Content with CollectionID ${collectionID} does not exist`);
            return;
        }
        ;
        const update = draftContentHelperFunctions.GenerateCollectionUpsertQuery(collectionID, paragraphContent, position);
        const updateResponse = await collection.updateOne(findQuery, update, { upsert: true });
        if (!updateResponse.acknowledged)
            return res.status(500).send('An error occured with inserting into the database');
        //No collection id, one was generated in the update object
        !collectionID
            ? res.status(200).send(update.$push.content.$each[0]._id)
            : res.status(200).send(paragraphContent);
    });
});
app.post(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, async (req, res) => {
    var _a, _b;
    const imagePathNotDefined = `path value was not defined. This is required when creating a new blog Element of type "image"`;
    const cssIsNotAnObject = `The CSS Object provided was not an acceptable object`;
    const invalidID = `ID must be a 24 character hex string`;
    const invalidCollectionID = `Draft ID must be a 24 character hex string`;
    const positionIsNotNumber = `Position must be a number`;
    const type = "Image";
    const id = req.params.id;
    const position = req.body.position !== null && req.body.position !== undefined
        ? parseInt(req.body.position)
        : null;
    const collectionID = (_b = (_a = req.params) === null || _a === void 0 ? void 0 : _a.collectionID) !== null && _b !== void 0 ? _b : null;
    let css = {};
    if (req.body.css)
        try {
            css = JSON.parse(req.body.css);
        }
        catch {
            return res.status(400).send(cssIsNotAnObject);
        }
    if (id.length !== 24)
        return res.status(400).send(invalidID);
    if (collectionID && collectionID.length !== 24)
        return res.status(400).send(invalidCollectionID);
    if (!req.body.path && !req.params.collectionID)
        return res.status(400).send(imagePathNotDefined);
    if (position !== null && position !== undefined && isNaN(position))
        return res.status(400).send(positionIsNotNumber);
    if (req.body.css && Array.isArray(css))
        return res.status(400).send(cssIsNotAnObject);
    const findQuery = draftContentHelperFunctions.generateCollectionFindQuery(req, type);
    const collection = client.db(dbName).collection(draftCollectionName);
    const imageContent = {
        type: type,
        path: req.body.path,
        css: css
    };
    client.connect(async () => {
        // updating existing content with a new position
        if (collectionID && position)
            return await draftContentHelperFunctions.moveContent(res, req, findQuery, ['css', 'path']);
        // upsert (no rearrange) / insert with position
        const findResponse = await collection.findOne(findQuery);
        if (!findResponse) {
            res.status(404).send(`Content with CollectionID ${collectionID} does not exist`);
            return;
        }
        ;
        const update = draftContentHelperFunctions.GenerateCollectionUpsertQuery(collectionID, imageContent, position);
        const updateResponse = await collection.updateOne(findQuery, update, { upsert: true });
        if (!updateResponse.acknowledged)
            return res.status(500).send('An error occured with inserting into the database');
        //No collection id, one was generated in the update object
        !collectionID
            ? res.status(200).send(update.$push.content.$each[0]._id)
            : res.status(200).send(imageContent);
    });
});
app.post(`${blogAdminPostPath}/draft/:id/body/Code`, authToken, async (req, res) => {
    //TODO
});
app.post(`${blogAdminPostPath}/draft/publish`, authToken, async (req, res) => {
    var _a;
    const draftID = (_a = req.body) === null || _a === void 0 ? void 0 : _a.draftID;
    if (!draftID) {
        res.status(400).send(`Must provide a draftID`);
        return;
    }
    if (draftID.length !== 24) {
        res.status(400).send(`Invalid draftID`);
        return;
    }
    client.connect(async () => {
        var _a;
        const draftCollection = client.db(dbName).collection(draftCollectionName);
        const publishCollection = client.db(dbName).collection(publishCollectionName);
        const query = { _id: new mongodb_1.ObjectId(draftID) };
        const draft = await draftCollection.findOne(query);
        if (!draft) {
            res.status(404).send(`Could not find draft with ID: ${draftID}`);
            return;
        }
        if (!(draft === null || draft === void 0 ? void 0 : draft.title)) {
            res.status(400).send(`Title on draft was not defined`);
            return;
        }
        if (!(draft === null || draft === void 0 ? void 0 : draft.summary)) {
            res.status(400).send(`summary on draft was not defined`);
            return;
        }
        if (!(draft === null || draft === void 0 ? void 0 : draft.author)) {
            res.status(400).send(`author on draft was not defined`);
            return;
        }
        if (!(draft === null || draft === void 0 ? void 0 : draft.date)) {
            res.status(400).send(`date on draft was not defined`);
            return;
        }
        if (draft.content.length === 0) {
            res.status(400).send(`No content was specified for draft`);
            return;
        }
        const post = {
            content: draft.content,
            title: draft.title,
            summary: draft.summary,
            author: draft.author,
            date: draft.date
        };
        const creationResponse = (draft === null || draft === void 0 ? void 0 : draft.postID)
            ? await publishCollection.replaceOne({ _id: new mongodb_1.ObjectId(draft.postID) }, post)
            : await publishCollection.insertOne(post);
        if (!creationResponse.acknowledged) {
            res.status(500).send('Database didn\'t acknowledge transaction');
            return;
        }
        await draftCollection.deleteOne({ _id: new mongodb_1.ObjectId(draftID) });
        res.status(201).send({ postID: (_a = draft === null || draft === void 0 ? void 0 : draft.postID) !== null && _a !== void 0 ? _a : creationResponse.insertedId });
    });
});
app.get(`${blogAdminPostPath}/draft/:id`, authToken, async (req, res) => {
    const id = req.params.id;
    if (id.length !== 24) {
        res.status(400).send(`Draft ID must be a 24 character hex string`);
        return;
    }
    client.connect(async () => {
        const collection = client.db(dbName).collection(draftCollectionName);
        const query = { _id: new mongodb_1.ObjectId(req.params.id) };
        const draft = await collection.findOne(query);
        if (!draft) {
            res.status(404).send('Could not find draft matching the provided ID');
            return;
        }
        ;
        res.send(draft);
    });
});
app.get(`${blogAdminPostPath}/drafts`, authToken, async (req, res) => {
    client.connect(async () => {
        const collection = client.db(dbName).collection(draftCollectionName);
        const result = await collection.find().toArray();
        res.send(result);
    });
});
//testing
app.get(`${blogAPIPath}/posts`, async (req, res) => {
    client.connect(async () => {
        const collection = client.db(dbName).collection(publishCollectionName);
        const result = await collection.find().toArray();
        res.send(result);
    });
});
app.listen(3000, () => console.log('blog server running on port 3000!'));
