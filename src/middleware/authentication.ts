import axios from 'axios';
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
      return res.sendStatus(401); //bad request
  
    jwt.verify(token, process.env.TOKEN_SECRET as string, (err: any, data: any) => {
      if (err) 
        return res.sendStatus(403);
      
      req.decryptJWT = data
      return next()
    });
}

export const captchaMiddleware = async (req: any, res: any, next: any) => {
  const { captchaToken } = req.body;
  if (!captchaToken) return res.status(400).send('Captcha token is required');

  const secret = process.env.SECRET_KEY;
  const verificationURL = `https://www.google.com/recaptcha/api/siteverify?secret=${secret}&response=${captchaToken}`;

  try {
      const response = await axios.post(verificationURL, {
          headers: { "Content-Type": "application/x-www-form-urlencoded; charset=utf-8" }
      });

      if (!response.data.success) return res.json({ success: false });
      
      return next();
  } catch {
      return res.json({ success: false });
  }

}