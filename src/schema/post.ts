import { userSchema } from "./user"

export interface BlogPostContent {
    _id: string,
    type: string,
    css?: object
}

export interface BlogPostImage extends BlogPostContent {
    type: "Image"
    path: string
}

export interface BlogPostParagraph extends BlogPostContent {
    type: "Paragraph"
    text: string
}

export interface BlogPostCodeBlock extends BlogPostContent {
    type: "Code"
    language: string
    code: string
}

export interface BlogPost extends BlogPostMeta {
    content: (BlogPostImage | BlogPostParagraph | BlogPostCodeBlock)[]
}

export interface BlogPostMeta {
    title?: string
    summary?: string
    author?: userSchema["username"]
    date?: string
    slug?: string
    tags: string[]
}

export interface BlogPostDraft extends BlogPost, BlogPostMeta {
    draftID: string
    postID?: string //DO NOT CHANGE OUTSIDE OF CREATING
}

export interface BlogPostProduction extends BlogPost, BlogPostMeta {
    title: string
    summary: string
    author: userSchema["username"]
    date: string
    slug: string
    tags: string[]
    _id: string 
}

