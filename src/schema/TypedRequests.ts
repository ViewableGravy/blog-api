import { Send, Query } from 'express-serve-static-core';

export interface RequestBody<B> extends Express.Request {
    body: B
}

export interface RequestQuery<Q extends Query> extends Express.Request {
    query: Q
}

export interface RequestParams<P> extends Express.Request {
    params: P
}

export interface Request<Q = undefined, B = undefined, P = undefined> extends Express.Request {
    body: B,
    query: Q,
    params: P
}

export interface Response<ResBody> extends Express.Response {
    send: Send<ResBody, this>
    status(code: number): this;
}