"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.expressServer = void 0;
const mongodb_1 = require("mongodb");
const login_1 = require("./routes/login");
const createDraft_1 = require("./routes/createDraft");
const deleteDraft_1 = require("./routes/deleteDraft");
const deletePost_1 = require("./routes/deletePost");
const authentication_1 = require("./middleware/authentication");
const upsertDraftMeta_1 = require("./routes/upsertDraftMeta");
const delete_1 = require("./routes/paragraph/delete");
const publishDraft_1 = require("./routes/publishDraft");
const insert_1 = require("./routes/paragraph/insert");
const override_1 = require("./routes/paragraph/override");
const patch_1 = require("./routes/paragraph/patch");
const refreshToken_1 = require("./routes/refreshToken");
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const dotenv_1 = __importDefault(require("dotenv"));
const cors_1 = __importDefault(require("cors"));
const contact_1 = require("./routes/contact");
const url_1 = require("url");
const sockets_1 = require("./sockets");
const status_1 = require("./sockets/status");
const server = `192.168.20.20:27017`;
const dbName = `blog`;
const draftCollectionName = `drafts`;
const publishCollectionName = `published`;
const client = new mongodb_1.MongoClient(`mongodb://${server}`);
const apiPath = '/api';
const blogAPIPath = '/api/blog';
const blogAdminPostPath = '/api/blog/admin/post';
dotenv_1.default.config({ path: __dirname + '/.env' });
const blog = (0, express_1.default)();
blog.use(body_parser_1.default.json());
blog.use(body_parser_1.default.urlencoded({ extended: false }));
blog.use((0, cors_1.default)());
blog.use(express_1.default.json());
////////////////////////// Base ////////////////////////////
blog.get(`${apiPath}/`, (req, res) => {
    res.send('Hello World!');
});
//////////////////////// Auth //////////////////////////
blog.post(`${apiPath}/login`, login_1.loginRouteValidator, (0, login_1.loginRoute)(client));
blog.post(`${apiPath}/refreshToken`, authentication_1.authToken, (0, refreshToken_1.refreshTokenRoute)(client));
//////////////////////// BLOG //////////////////////////
blog.post(`${blogAdminPostPath}/draft/`, authentication_1.authToken, createDraft_1.createDraftValidator, (0, createDraft_1.createDraftRoute)(client));
blog.post(`${blogAdminPostPath}/draft/publish`, authentication_1.authToken, publishDraft_1.publishDraftValidator, (0, publishDraft_1.publishDraftRoute)(client));
blog.delete(`${blogAdminPostPath}/draft/delete/:id`, authentication_1.authToken, deleteDraft_1.deleteDraftValidator, (0, deleteDraft_1.deleteDraftRoute)(client));
blog.delete(`${blogAdminPostPath}/delete/:id`, authentication_1.authToken, deletePost_1.deletePostValidator, (0, deletePost_1.deletePostRoute)(client));
blog.delete(`${blogAdminPostPath}/draft/:id/body/delete/:collectionID`, authentication_1.authToken, delete_1.deleteContentValidator, (0, delete_1.deleteContentRoute)(client));
blog.put(`${blogAdminPostPath}/draft/:id/meta`, authentication_1.authToken, upsertDraftMeta_1.upsertDraftValidator, (0, upsertDraftMeta_1.upsertDraftRoute)(client));
//app.put(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID?`, authToken, upsertParagraphValidator, upsertParagraphRoute(client));
// app.post(`${blogAdminPostPath}/draft/:id/meta`, authToken, insertDraftValidator, insertDraftRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/meta`, authToken, updateDraftValidator, updateDraftRoute(client));
// app.put(`${blogAdminPostPath}/draft/:id/meta`, authToken, overrideDraftValidator, overrideDraftRoute(client));
blog.post(`${blogAdminPostPath}/draft/:id/body/paragraph/`, authentication_1.authToken, insert_1.insertParagraphValidator, (0, insert_1.insertParagraphRoute)(client));
blog.put(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID`, authentication_1.authToken, override_1.putParagraphValidator, (0, override_1.putParagraphRoute)(client));
blog.patch(`${blogAdminPostPath}/draft/:id/body/paragraph/:collectionID`, authentication_1.authToken, patch_1.patchParagraphValidator, (0, patch_1.patchParagraphRoute)(client));
// app.post(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, insertImageValidator, insertImageRoute(client));
// app.put(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, updateImageValidator, updateImageRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, overrideImageValidator, overrideImageRoute(client));
// app.post(`${blogAdminPostPath}/draft/:id/body/code/:collectionID?`, authToken, insertCodeValidator, insertCodeRoute(client));
// app.put(`${blogAdminPostPath}/draft/:id/body/code/:collectionID?`, authToken, updateCodeValidator, updateCodeRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/body/code/:collectionID?`, authToken, overrideCodeValidator, overrideCodeRoute(client));
// app.patch(`${blogAdminPostPath}/draft/:id/body/move/:collectionID?`, authToken, moveContentValidator, moveContenthRoute(client));
blog.get(`${blogAdminPostPath}/draft/:id`, authentication_1.authToken, async (req, res) => {
    const id = req.params.id;
    if (id.length !== 24) {
        res.status(400).send(`Draft ID must be a 24 character hex string`);
        return;
    }
    const connection = await client.connect();
    const collection = connection.db(dbName).collection(draftCollectionName);
    const query = { _id: new mongodb_1.ObjectId(id) };
    const draft = await collection.findOne(query);
    if (!draft) {
        res.status(404).send('Could not find draft matching the provided ID');
        return;
    }
    ;
    res.send(draft);
});
blog.get(`${blogAdminPostPath}/drafts`, authentication_1.authToken, async (req, res) => {
    const connection = await client.connect();
    const collection = connection.db(dbName).collection(draftCollectionName);
    const result = await collection.find().toArray();
    res.send(result);
});
blog.get(`${blogAPIPath}/posts`, async (req, res) => {
    const connection = await client.connect();
    const collection = connection.db(dbName).collection(publishCollectionName);
    const result = await collection.find().toArray();
    res.send(result);
});
//ToDo sanitize input
blog.get(`${blogAPIPath}/posts/:slug`, async (req, res) => {
    const connection = await client.connect();
    const collection = connection.db(dbName).collection(publishCollectionName);
    const result = await collection.find({ slug: req.params.slug }).toArray();
    if (result.length === 0)
        return res.sendStatus(404);
    return res.send(result[0]);
});
////////////////////////// CAPTCHA ////////////////////////////
//TODO, install express-santizer and sanitize input
blog.post(`/api/contact`, authentication_1.captchaMiddleware, contact_1.CommentRouteValidator, contact_1.CommentRoute);
////////////////////////// SERVER ////////////////////////////
const port = process.env.PORT || 3000;
exports.expressServer = blog.listen(port, () => console.log(`Server running on port ${port}!`));
exports.expressServer.on('upgrade', (req, socket, head) => {
    var _a;
    const { pathname } = (0, url_1.parse)((_a = req === null || req === void 0 ? void 0 : req.url) !== null && _a !== void 0 ? _a : '');
    console.log('pathname: ', pathname);
    switch (pathname) {
        case '/api/socket':
            sockets_1.generalSocketServer.handleUpgrade(req, socket, head, (ws) => {
                sockets_1.generalSocketServer.emit('connection', ws, req);
            });
            break;
        case '/api/status':
            status_1.wsServerStatus.handleUpgrade(req, socket, head, (ws) => {
                status_1.wsServerStatus.emit('connection', ws, req);
            });
        default:
            socket.destroy();
    }
});
