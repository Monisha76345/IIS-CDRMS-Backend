import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import type { CreateNotificationInput } from './dto/create-notification.dto';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepo: Repository<Notification>,
  ) {}

  async create(input: CreateNotificationInput): Promise<Notification> {
    const row = this.notificationRepo.create({
      userId: input.userId,
      title: input.title,
      message: input.message,
      type: input.type || 'general',
      isRead: false,
      applicationId: input.applicationId ?? null,
      applicationNumber: input.applicationNumber ?? null,
      linkPath: input.linkPath ?? null,
      createdBy: input.createdBy ?? null,
    });
    return this.notificationRepo.save(row);
  }

  async createMany(inputs: CreateNotificationInput[]): Promise<Notification[]> {
    if (!inputs.length) return [];
    const rows = inputs.map((input) =>
      this.notificationRepo.create({
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type || 'general',
        isRead: false,
        applicationId: input.applicationId ?? null,
        applicationNumber: input.applicationNumber ?? null,
        linkPath: input.linkPath ?? null,
        createdBy: input.createdBy ?? null,
      }),
    );
    return this.notificationRepo.save(rows);
  }

  async listMine(userId: string, limit = 50): Promise<Notification[]> {
    return this.notificationRepo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    const count = await this.notificationRepo.count({
      where: { userId, isRead: false },
    });
    return { count };
  }

  async markRead(id: string, userId: string): Promise<Notification> {
    const row = await this.notificationRepo.findOne({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Notification not found');
    }
    if (!row.isRead) {
      row.isRead = true;
      row.updatedBy = userId;
      return this.notificationRepo.save(row);
    }
    return row;
  }

  async markAllRead(userId: string): Promise<{ updated: number }> {
    const result = await this.notificationRepo.update(
      { userId, isRead: false },
      { isRead: true, updatedBy: userId },
    );
    return { updated: result.affected ?? 0 };
  }
}
