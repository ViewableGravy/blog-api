"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const body_parser_1 = __importDefault(require("body-parser"));
const mongodb_1 = require("mongodb");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const dotenv_1 = __importDefault(require("dotenv"));
const server = `localhost:27017`;
const dbName = `blog`;
const authDB = `auth`;
const client = new mongodb_1.MongoClient(`mongodb://${server}`);
dotenv_1.default.config({ path: __dirname + '/.env' });
const app = (0, express_1.default)();
app.use(body_parser_1.default.json());
app.use(body_parser_1.default.urlencoded({ extended: false }));
const generateAccessToken = (username) => {
    if (!process.env.TOKEN_SECRET)
        throw new TypeError;
    return jsonwebtoken_1.default.sign(username, process.env.TOKEN_SECRET, { expiresIn: '1800s' });
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
app.post('/api/user/login', (req, res) => {
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
//testing
app.post('/create', authToken, async (req, res) => {
    client.connect(() => {
        let collection = client.db(dbName).collection("blogs");
        res.send(collection.insertOne({ name: req.body.content }));
    });
});
//testing
app.get('/', authToken, async (req, res) => {
    client.connect(async () => {
        let collection = client.db(dbName).collection("blogs");
        let result = await collection.find().toArray();
        res.send(result);
    });
});
app.post('/blog/api/admin/post/draft', authToken, async (req, res) => {
    //creates a blank draft for a post
    //returns a draft id
    return 0;
});
app.get('/blog/api/admin/post/draft/:id', authToken, async (req, res) => {
    return {
        title: "",
        summary: "",
        author: "",
        date: "",
        status: "draft",
        id: 1,
        content: [{
                type: "Image",
                image: new URL("/content"),
                css: {}
            }]
    };
});
// body: {author:"", title: "", summary: "", date: ""}
app.post('/blog/api/admin/post/draft/:id/meta', authToken, async (req, res) => {
    //update author, title, summary, date 
});
app.post('/blog/api/admin/post/draft/:id/body/paragraph', authToken, async (req, res) => {
    //insert a paragraph
    //requires draft id
});
app.listen(3000, () => console.log('blog server running on port 3000!'));
