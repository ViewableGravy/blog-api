import { NextFunction } from 'express';
import * as TypedRequest from '../schema/TypedRequests';

const nodemailer = require('nodemailer');

const authDB = `auth`;

//support logging in using a username rather than an email

type CommentReqType = TypedRequest.RequestBody<{name: string, email: string, message: string}>;
type CommentResType = TypedRequest.Response<{}>;
type ExpressRouteFunc = (req: CommentReqType, res: CommentResType, next?: NextFunction) => void | Promise<void>;

export const CommentRoute = async (req: CommentReqType, res: CommentResType): Promise<Express.Response> => {
  const { name, email, message } = req.body;

  const emailHost = process.env.EMAIL_HOST || '';
  const emailPort = process.env.EMAIL_PORT || '';
  const emailUser = process.env.EMAIL_USER || '';
  const emailPassword = process.env.EMAIL_PASS || '';
  const emailEncryption = process.env.EMAIL_ENCRYPTION || '';

  if (!emailHost || !emailPort || !emailUser || !emailPassword || !emailEncryption) {
      return res.status(500).send('Email server not configured');
  }

  const emailDetails = {
      from: 'contact@gravy.cc',
      to: 'lleyton92@gmail.com',
      subject: `Contact Form Submission from ${name}`,
      text: `From: ${name} <${email}> \n\n ${message}`
  };

  console.log(`${emailHost}\n${emailPort}\n${emailUser}\n${emailPassword}\n${emailEncryption}`)

  const transport = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: true,
      auth: {
          user: emailUser,
          pass: emailPassword
      }
  });

  try {
      const info = await transport.sendMail(emailDetails);
      console.log(`Message sent: ${info.messageId}`);
  } catch (error) {
      console.log(error);
      return res.status(500).send('Message failed to send');
  }

  return res.status(200).send('Message sent');
}

//probably do some sanitisation here
export const CommentRouteValidator = (req: CommentReqType, res: CommentResType, next: () => any): Express.Response | NextFunction => {
  const { name, email, message } = req.body;

  if (!name) return res.status(400).send('Name is required');
  if (!email) return res.status(400).send('Email is required');
  if (!message) return res.status(400).send('Message is required');

  return next();
}