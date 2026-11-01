// src/controllers/contact.controller.ts
import { Request, Response } from 'express';
import { ContactService } from '../services/contact.service';
import { asyncHandler } from '../middleware/error';

export class ContactController {
  static submit = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, message } = req.body;
    const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress;

    const result = await ContactService.submitMessage({
      name,
      email,
      message,
      ipAddress
    });

    res.status(201).json({
      success: true,
      message: 'Message delivered to Central Secretariat',
      id: result.id
    });
  });
}