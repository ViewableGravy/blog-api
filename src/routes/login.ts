import { NextFunction } from 'express';
import { userSchema } from '../schema/user';
import { MongoClient } from 'mongodb';
import { generateAccessToken } from '../middleware/authentication';
import jwt from 'jsonwebtoken';
import * as TypedRequest from '../schema/TypedRequests';
import { ReservedOrUserEventNames } from 'socket.io/dist/typed-events';

const authDB = `auth`;

//support logging in using a username rather than an email

type loginReqType = TypedRequest.RequestBody<{email: string, password: string}>;
type loginResType = TypedRequest.Response<{username: string, access_token: string} | string>;
type ExpressRouteFunc = (req: loginReqType, res: loginResType, next?: NextFunction) => void | Promise<void>;

export const loginRoute = (mongoClient: MongoClient): ExpressRouteFunc => {
  return async (req: loginReqType, res: loginResType) => {
    //sanitize inputs here

    type LoginCredentials = Omit<userSchema, 'username' | '_id'>;
    const getUser: LoginCredentials = {
      email: req.body?.email,
      password: req.body?.password
    }

    mongoClient.connect(async () => {
      const collection = mongoClient.db(authDB).collection(authDB);
      const dbUser = await collection.findOne({ email: getUser.email }) as userSchema;

      if (!dbUser) return res.status(401).send(`User not found`);
      if (dbUser.password != getUser.password) return res.status(401).send(`Authentication Failed`);
      
      res.status(200).send({
        username: dbUser.username,
        access_token: generateAccessToken({username: dbUser.username})
      });
    });
  }
}

//probably do some sanitisation here
export const loginRouteValidator = (req: loginReqType, res: loginResType, next: () => any): Express.Response | NextFunction => {
  if (!req.body?.email) return res.status(400).send("email is not defined")
  if (!req.body?.password) return res.status(400).send("Password is not defined")
  return next();
}