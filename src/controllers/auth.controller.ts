import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
  static async login(req: Request, res: Response) {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
      const result = await AuthService.login(email, password);

      res.cookie('token', result.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 8 * 60 * 60 * 1000, // 8 hours matching JWT
      });

      return res.status(200).json({
        token: result.token,
        user: result.user,
      });
    } catch (error: any) {
      return res.status(401).json({ error: error.message || 'Invalid credentials' });
    }
  }

  static async logout(_req: Request, res: Response) {
    res.clearCookie('token');
    return res.status(200).json({ message: 'Successfully logged out' });
  }
}