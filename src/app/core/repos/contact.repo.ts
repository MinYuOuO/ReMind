import { Injectable } from '@angular/core';
import { SqliteDbService } from '../services/db.service';

// 定义联系人关系类型 (Enum-like type for relationship)
export type Relationship = 'friend' | 'best_friend' | 'colleague' | 'family' | 'myself';

// Defines the structure of a Contact record (matches SQLite table schema)
export interface Contact {
  contact_id: string;
  user_id: string;
  name: string;
  relationship: Relationship;
  contact_detail?: string | null;
  birthday?: string | null; // 'DD-MM-YYYY'
  created_at: string; // ISO
  updated_at: string; // ISO
  notes?: string | null;
}

// 工具函数 - 获取当前时间 ISO 字符串
// Helper function: get current time in ISO format
const now = () => new Date().toISOString();

// 工具函数 - 生成唯一 ID
// Helper function: generate a unique ID (UUID if available)
const uid = () =>
  crypto?.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

/**
 * ContactRepo 服务类
 *
 * 此类封装了所有与 "contact" 表相关的数据库操作。
 * 用于从 SQLite 数据库中获取、创建联系人数据。
 *
 * This service handles all contact-related database operations.
 * It interacts with the local SQLite database via SqliteDbService.
 */
@Injectable({ providedIn: 'root' })
export class ContactRepo {
  constructor(private db: SqliteDbService) {}

  /**
   * 根据 userId 获取该用户的所有联系人
   * Fetch all contacts belonging to a specific user
   *
   * @param userId 用户ID
   * @returns Promise<Contact[]> 联系人列表
   */
  listByUser(userId: string): Promise<Contact[]> {
    return this.db.query<Contact>(
      // COLLATE NOCASE ensures case-insensitive sorting by name
      `SELECT * FROM contact WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC`,
      [userId]
    );
  }

  /**
   * 创建一个新的联系人记录 (最简信息)
   * Create a new contact record with minimal fields
   *
   * @param userId 所属用户ID (User who owns this contact)
   * @param name 联系人姓名 (Contact name)
   * @param relationship 联系关系类型 (Default: 'friend')
   * @param contact_detail 联系方式 (phone/email)
   * @param birthday 生日 ('YYYY-MM-DD')
   * @param notes 备注信息 (Optional notes)
   * @returns Promise<Contact> 返回创建的联系人对象
   */
  async createMinimal(
    userId: string = "",               // 用户 ID，可为空字符串
    name: string,                      // 联系人姓名
    relationship: Relationship = 'myself', // 联系关系类型（默认 friend）
    contact_detail: string = "",       // 联系方式，可为空
    birthday: string = "",             // 生日，可为空
    notes: string = ""                 // 新增备注参数，可为空
  ): Promise<Contact> {
    // Create a new unique contact ID
    const contact_id = uid();

    // Build the Contact object for insertion
    const rec: Contact = {
      contact_id: contact_id,          // 唯一 ID
      user_id: userId,                 // 所属用户 ID
      name: name,                      // 联系人姓名
      relationship: relationship,      // 关系类型
      contact_detail: contact_detail || null, // 联系方式，可为空
      birthday: birthday || null,      // 生日，可为空
      created_at: now(),               // 创建时间
      updated_at: now(),               // 更新时间
      notes: notes || null,            // 备注，可为空
    };

    // Execute SQL INSERT to save the new contact
    await this.db.run(
      `INSERT INTO contact (
        contact_id,
        user_id,
        name,
        relationship, 
        contact_detail,
        birthday,
        created_at,
        updated_at,
        notes
      ) VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        rec.contact_id,
        rec.user_id,
        rec.name,
        rec.relationship,
        rec.contact_detail,
        rec.birthday,
        rec.created_at,
        rec.updated_at,
        rec.notes,
      ]
    );

    // persistence for web is handled centrally in SqliteDbService.run(), so no-op here

    // 返回刚创建的联系人对象
    // Return the newly created contact record
    return rec;
  }

  /**
   * Delete a contact by id
   * @param contactId contact_id to delete
   */
  async delete(contactId: string): Promise<void> {
    if (!contactId) return;
    await this.db.run(
      `DELETE FROM contact WHERE contact_id = ?`,
      [contactId]
    );
  }
}
