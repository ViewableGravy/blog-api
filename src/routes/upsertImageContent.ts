// app.post(`${blogAdminPostPath}/draft/:id/body/image/:collectionID?`, authToken, async (req: TypedRequest.Request<undefined, {css: string, path: string, position: string | undefined}, { id: string, collectionID: string | null }>,res) => {
//     const imagePathNotDefined = `path value was not defined. This is required when creating a new blog Element of type "image"`
//     const cssIsNotAnObject    = `The CSS Object provided was not an acceptable object`
//     const invalidID           = `ID must be a 24 character hex string`
//     const invalidCollectionID = `Draft ID must be a 24 character hex string`
//     const positionIsNotNumber = `Position must be a number`

//     const type = "Image";
//     const id = req.params.id;
//     const position = req.body.position !== null && req.body.position !== undefined 
//         ? parseInt(req.body.position) 
//         : null;
//     const collectionID = req.params?.collectionID ?? null;

//     let css: { [key: string]: any} = {};
//     if (req.body.css)
//         try   { css = JSON.parse(req.body.css); } 
//         catch { return res.status(400).send(cssIsNotAnObject) }

//     if (id.length !== 24)                                               return res.status(400).send(invalidID          );
//     if (collectionID && collectionID.length !== 24)                     return res.status(400).send(invalidCollectionID);
//     if (!req.body.path && !req.params.collectionID)                     return res.status(400).send(imagePathNotDefined);
//     if (position !== null && position !== undefined && isNaN(position)) return res.status(400).send(positionIsNotNumber);
//     if (req.body.css && Array.isArray(css))                             return res.status(400).send(cssIsNotAnObject   );

//     const findQuery = draftContentHelperFunctions.generateCollectionFindQuery(req, type);
//     const collection = client.db(dbName).collection(draftCollectionName);
//     const imageContent: Omit<postContent.BlogPostImage, "_id"> = {
//         type: type,
//         path: req.body.path,
//         css: css
//     }

//     client.connect(async () => {
//         // updating existing content with a new position
//         if (collectionID && position)
//             return await draftContentHelperFunctions.moveContent(res, req, findQuery, ['css', 'path']);
        
//         // upsert (no rearrange) / insert with position
//         const findResponse = await collection.findOne(findQuery);
//         if (!findResponse) { res.status(404).send(`Content with CollectionID ${collectionID} does not exist`); return };

//         const update = draftContentHelperFunctions.GenerateCollectionUpsertQuery(collectionID, imageContent, position)
//         const updateResponse = await collection.updateOne(findQuery, update, { upsert: true });

//         if (!updateResponse.acknowledged) return res.status(500).send('An error occured with inserting into the database');

//         //No collection id, one was generated in the update object
//         !collectionID
//             ? res.status(200).send((update as any).$push.content.$each[0]._id)
//             : res.status(200).send(imageContent);
//     });
// });