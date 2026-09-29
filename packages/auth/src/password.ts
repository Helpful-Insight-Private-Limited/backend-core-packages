import bcrypt from 'bcryptjs';

export class PasswordHash {
  static async hash(plainPassword: string, rounds = 12): Promise<string> {
    const salt = await bcrypt.genSalt(rounds);
    return bcrypt.hash(plainPassword, salt);
  }

  static async compare(plainPassword: string, hash: string): Promise<boolean> {
    if (!plainPassword || !hash) return false;
    return bcrypt.compare(plainPassword, hash);
  }
}
