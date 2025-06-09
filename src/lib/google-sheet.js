import dotenv from 'dotenv';
import { GoogleSheetService } from 'google-sheet-crud';

dotenv.config();

const credentials = {
  client_email: process.env.GOOGLE_CLIENT_EMAIL || '',
  private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

const sheetService = new GoogleSheetService(credentials);

export class Sheet {
  static async create(sheetId, range, data) {
    return await sheetService.create({ sheetId, range, data });
  }

  static async read(sheetId, range) {
    return await sheetService.get({ sheetId, range });
  }

  static async update(sheetId, range, data, id) {
    return await sheetService.update({ sheetId, range, data, id });
  }

  static async delete(sheetId, range, id) {
    return await sheetService.delete({
      sheetId,
      range,
      id,
    });
  }
}
