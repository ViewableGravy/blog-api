import { NextFunction } from 'express';
import { userSchema } from '../schema/user';
import { MongoClient } from 'mongodb';
import { generateAccessToken } from '../middleware/authentication';
import jwt from 'jsonwebtoken';
import * as TypedRequest from '../schema/TypedRequests';

const authDB = `auth`;

type loginReqType = TypedRequest.RequestBody<{username: string, password: string}>;
type loginResType = TypedRequest.Response<{message: string, access_token: string} | string>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

export const loginRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
  return async (req: loginReqType, res: loginResType) => {
    const message = `connected successfully with username: ${req.body.username} and password: ${req.body.password}`;

    const user: userSchema = {
      username: req.body?.username,
      password: req.body?.password,
      name: undefined
    }

    mongoClient.connect(async () => {
      const collection = mongoClient.db(authDB).collection(authDB);
      const dbUser = await collection.findOne({ username: user.username });

      if (!dbUser) return res.status(404).send(`user ${user.username} not found`);
      if (dbUser.password != user.password) return res.status(401).send(`Authentication Failed`);
      
      res.status(200).send({
        message: message,
        access_token: generateAccessToken({username: user.username})
      });
    });
  }
}

export const loginRouteValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
  if (!req.body?.username) return res.status(400).send("Username is not defined")
  if (!req.body?.password) return res.status(400).send("Password is not defined")
  return next();
}