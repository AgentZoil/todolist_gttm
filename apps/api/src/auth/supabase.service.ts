import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
    }

    this.client = createClient(url, key);
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  async getUserByEmail(email: string) {
    const { data, error } = await this.client.auth.admin.listUsers();
    if (error) throw error;
    return data.users.find((u) => u.email === email) || null;
  }

  async getOrCreateUser(email: string, fullName: string, password: string) {
    const existing = await this.getUserByEmail(email);
    if (existing) return existing;

    const { data, error } = await this.client.auth.admin.createUser({
      email,
      email_confirm: true,
      password,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    return data.user;
  }
}
