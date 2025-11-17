import { Injectable } from '@angular/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { SqliteDbService } from './db.service';
import { DbInitService } from './db-inti.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  constructor(private db: SqliteDbService, private dbInit: DbInitService) {}

  async scheduleBirthdayNotifications() {
    try {
      const contacts = await this.db.query(`
        SELECT contact_id, name, birthday 
        FROM contact 
        WHERE birthday IS NOT NULL AND birthday != ''
      `);

      // Clear existing notifications
      await this.clearBirthdayNotifications();

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      for (const contact of contacts) {
        await this.scheduleContactBirthdayNotifications(contact, today);
      }

      console.log('[Notification] Birthday notifications scheduled for', contacts.length, 'contacts');
    } catch (err) {
      console.error('[Notification] Failed to schedule birthday notifications:', err);
    }
  }

  private async scheduleContactBirthdayNotifications(contact: any, today: Date) {
    try {
      const birthdayDate = new Date(contact.birthday);
      if (isNaN(birthdayDate.getTime())) return;

      // Create next birthday date
      const nextBirthday = new Date(
        today.getFullYear(),
        birthdayDate.getMonth(),
        birthdayDate.getDate(),
        9, // 9 AM
        0
      );

      // If birthday has already passed this year, schedule for next year
      if (nextBirthday < today) {
        nextBirthday.setFullYear(nextBirthday.getFullYear() + 1);
      }

      // Calculate day before notification date
      const dayBefore = new Date(nextBirthday);
      dayBefore.setDate(dayBefore.getDate() - 1);

      const notificationId = parseInt(contact.contact_id.replace(/\D/g, '')) || Math.floor(Math.random() * 100000);

      // Schedule both notifications
      const notifications = [];

      // Only add day-before notification if it's in the future
      if (dayBefore > today) {
        notifications.push({
          id: notificationId,
          title: `🎂 Birthday Tomorrow!`,
          body: `${contact.name}'s birthday is tomorrow!`,
          schedule: { at: dayBefore },
          sound: 'notification.wav',
          extra: {
            contactId: contact.contact_id,
            type: 'birthday_reminder'
          }
        });
      }

      // Add birthday notification
      notifications.push({
        id: notificationId + 1,
        title: `🎂 Birthday Today!`,
        body: `It's ${contact.name}'s birthday today!`,
        schedule: { at: nextBirthday },
        sound: 'notification.wav',
        extra: {
          contactId: contact.contact_id,
          type: 'birthday'
        }
      });

      if (notifications.length > 0) {
        await LocalNotifications.schedule({ notifications });

        // Persist scheduled notifications as reminders in DB
        try {
          await this.dbInit.init();
          await this.db.open();

          const now = new Date().toISOString();
          for (const n of notifications) {
            const remId = 'rem_' + (n.id ?? Math.floor(Math.random() * 1000000));
            const contactId = n.extra?.contactId ?? null;
            const title = n.title ?? '';
            const description = n.body ?? '';
            // determine dueDate safely — schedule may have { at } or other shapes (use guards)
            let dueDate = new Date().toISOString();
            try {
              if (n.schedule) {
                if ('at' in n.schedule && n.schedule.at) {
                  dueDate = new Date((n.schedule as any).at).toISOString();
                } else if ('every' in n.schedule && (n.schedule as any).every) {
                  dueDate = String((n.schedule as any).every);
                }
              }
            } catch (_e) {
              // fallback to now string on any parsing issue
              dueDate = new Date().toISOString();
            }
            // Use default values for user_id/priority/status
            const userId = 'u_local';
            const priority = 'medium';
            const status = 'pending';
            const reminderType = (n.extra?.type === 'birthday' || n.extra?.type === 'birthday_reminder') ? 'birthday' : (n.extra?.type === 'new_contact' ? 'follow_up' : 'follow_up');

            try {
              // Persist only when the scheduled day is today (local date)
              let shouldPersist = false;
              try {
                const due = new Date(dueDate);
                const today = new Date();
                if (!isNaN(due.getTime())) {
                  shouldPersist = due.getFullYear() === today.getFullYear() && due.getMonth() === today.getMonth() && due.getDate() === today.getDate();
                }
              } catch (e) {
                // if parsing fails, skip persist
                shouldPersist = false;
              }

              if (shouldPersist) {
                await this.db.run(
                  `INSERT OR REPLACE INTO reminder (reminder_id, contact_id, user_id, reminder_type, due_date, title, description, priority, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
                  [remId, contactId, userId, reminderType, dueDate, title, description, priority, status, now]
                );
              }
            } catch (e) {
              console.warn('[Notification] Failed to persist reminder for notification', n, e);
            }
          }
        } catch (e) {
          console.warn('[Notification] Could not persist reminders to DB', e);
        }
      }

      // Updated console log to include formatted birthday date
      console.log(`[Notification] Birthday notifications scheduled for ${contact.name} (Birthday: ${birthdayDate.toLocaleDateString()})`);
    } catch (err) {
      console.error('[Notification] Failed to schedule notifications for contact:', contact.name, err);
    }
  }

  async notifyNewContact(contact: any) {
    try {
      const notificationId = Math.floor(Math.random() * 100000);
      
      await LocalNotifications.schedule({
        notifications: [
          {
            id: notificationId,
            title: `👋 New Contact Added`,
            body: `${contact.name} has been added to your contacts!`,
            schedule: { at: new Date() }, // Show immediately
            sound: 'notification.wav',
            extra: {
              contactId: contact.contact_id,
              type: 'new_contact'
            }
          }
        ]
      });

      // Persist the new-contact notification as a reminder
      try {
        await this.dbInit.init();
        await this.db.open();
        const now = new Date().toISOString();
        const remId = 'rem_new_' + notificationId;
        await this.db.run(
          `INSERT OR REPLACE INTO reminder (reminder_id, contact_id, user_id, reminder_type, due_date, title, description, priority, status, created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`,
          [remId, contact.contact_id, 'u_local', 'follow_up', new Date().toISOString(), `New Contact: ${contact.name}`, `Automatically generated notification for new contact`, 'medium', 'pending', now]
        );
      } catch (e) {
        console.warn('[Notification] Could not persist new-contact reminder', e);
      }

      console.log(`[Notification] New contact notification sent for ${contact.name}`);
    } catch (err) {
      console.error('[Notification] Failed to send new contact notification:', err);
    }
  }

  private async clearBirthdayNotifications() {
    try {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        const birthdayNotifications = pending.notifications.filter(
          n => n.extra?.type === 'birthday' || n.extra?.type === 'birthday_reminder'
        );
        if (birthdayNotifications.length > 0) {
          await LocalNotifications.cancel({ notifications: birthdayNotifications });
        }
      }
    } catch (err) {
      console.warn('[Notification] Failed to clear existing notifications:', err);
    }
  }
}
