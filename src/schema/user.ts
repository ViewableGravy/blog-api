import { ObjectId } from "mongodb";

export interface userSchema {
    username: string;
    password: string;
    email: string;
    name?: string;
    about?: string;
    _id: ObjectId;
}