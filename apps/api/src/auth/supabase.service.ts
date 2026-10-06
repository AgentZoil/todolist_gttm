import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { randomBytes } from 'node:crypto';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient;

  onModuleInit() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SECRET_KEY;

    if (!url || !key) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY');
    }

    this.client = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  private newUnclaimedPassword() {
    return randomBytes(48).toString('base64url');
  }

  async createPendingUser(email: string, fullName: string) {
    const { data, error } = await this.client.auth.admin.createUser({
      email,
      password: this.newUnclaimedPassword(),
      email_confirm: false,
      user_metadata: { full_name: fullName },
      app_metadata: { registration_pending: true },
    });
    if (error) throw error;
    return data.user;
  }

  async deleteUser(authUserId: string) {
    const { error } = await this.client.auth.admin.deleteUser(authUserId);
    if (error) throw error;
  }

  async activateUserAndSendPasswordSetup(
    authUserId: string,
    email: string,
    fullName: string,
    redirectTo: string,
  ) {
    const { data: current, error: getError } =
      await this.client.auth.admin.getUserById(authUserId);
    if (getError) throw getError;
    const { data, error } = await this.client.auth.admin.updateUserById(
      authUserId,
      {
        password: this.newUnclaimedPassword(),
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: { ...current.user.app_metadata, registration_pending: false },
      },
    );
    if (error) throw error;

    const { error: resetError } = await this.client.auth.resetPasswordForEmail(
      email,
      { redirectTo },
    );
    if (resetError) throw resetError;

    return data.user;
  }
}
