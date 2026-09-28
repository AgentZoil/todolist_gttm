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

  async createUser(email: string, fullName: string, password: string) {
    const { data, error } = await this.client.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName },
    });
    if (error) throw error;
    return data.user;
  }

  async resetPendingUser(authUserId: string, fullName: string, password: string) {
    const { data, error } = await this.client.auth.admin.updateUserById(
      authUserId,
      {
        password,
        email_confirm: false,
        user_metadata: { full_name: fullName },
      },
    );
    if (error) throw error;
    return data.user;
  }

  async activateUser(authUserId: string) {
    const { data, error } = await this.client.auth.admin.updateUserById(
      authUserId,
      { email_confirm: true },
    );
    if (error) throw error;
    return data.user;
  }
}
