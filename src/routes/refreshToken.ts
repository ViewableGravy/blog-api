import { NextFunction } from 'express';
import { userSchema } from '../schema/user';
import { AnyBulkWriteOperation, MongoClient } from 'mongodb';
import {  generateAccessToken } from '../middleware/authentication';
import * as TypedRequest from '../schema/TypedRequests';

const authDB = `auth`;

//type loginReqType = { header: { authorization: string }, user: string }
type loginReqType = any;
type loginResType = TypedRequest.Response<{username: string, access_token: string} | string>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

//assumes that token is still valid
export const refreshTokenRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
  return async (req: loginReqType, res: loginResType) => {
    const username = req.decryptJWT.username;

    mongoClient.connect(async () => {
      const collection = mongoClient.db(authDB).collection(authDB);
      const dbUser = await collection.findOne({ username: username }) as userSchema;

      if (!dbUser) return res.status(404).send(`user not found`);
      
      res.status(200).send({
        username: dbUser.username,
        access_token: generateAccessToken({username: dbUser.username})
      });
    });
  }
}