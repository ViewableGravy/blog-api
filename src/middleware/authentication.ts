import jwt from 'jsonwebtoken';

export const generateAccessToken = (username: {username: string}) => {
    if (!process.env.TOKEN_SECRET) 
      throw new Error('Unable to find server Secret');
    return jwt.sign(username, process.env.TOKEN_SECRET, { expiresIn: '3d' });
}

export const authToken = (req: any, res: any, next: any) => {
    const authHeader = req.headers?.authorization;
    const token = authHeader && authHeader.split(' ')[1];
  
    if (token == null) 
      return res.sendStatus(401);
  
    jwt.verify(token, process.env.TOKEN_SECRET as string, (err: any, data: any) => {
      if (err) 
        return res.sendStatus(403);
      
      req.decryptJWT = data
      next()
    });
}