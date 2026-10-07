import { Injectable, OnModuleInit } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService implements OnModuleInit {
  private client: SupabaseClient<any, any, 'public', any, any>;

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

  getClient(): SupabaseClient<any, any, 'public', any, any> {
    return this.client;
  }

  async createPendingUser(email: string, fullName: string, password: string) {
    const { data, error } = await this.client.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { full_name: fullName },
      app_metadata: { registration_pending: true },
    });
    if (error) throw error;
    return data.user;
  }

  async updatePendingUser(
    authUserId: string,
    email: string,
    fullName: string,
    password: string,
  ) {
    const { data: current, error: getError } =
      await this.client.auth.admin.getUserById(authUserId);
    if (getError) throw getError;
    if (
      current.user.email?.toLowerCase() !== email ||
      current.user.email_confirmed_at ||
      current.user.app_metadata?.registration_pending !== true
    ) {
      throw new Error('Registration identity is not pending');
    }

    const { data, error } = await this.client.auth.admin.updateUserById(
      authUserId,
      {
        password,
        user_metadata: { full_name: fullName },
      },
    );
    if (error) throw error;
    return data.user;
  }

  async deleteUser(authUserId: string) {
    const { error } = await this.client.auth.admin.deleteUser(authUserId);
    if (
      error &&
      error.status !== 404 &&
      error.code !== 'user_not_found'
    ) {
      throw error;
    }
  }

  async approvePendingUser(
    authUserId: string,
    email: string,
    fullName: string,
  ) {
    const { data: current, error: getError } =
      await this.client.auth.admin.getUserById(authUserId);
    if (getError) throw getError;
    if (current.user.email?.toLowerCase() !== email) {
      throw new Error('Registration email does not match Auth user');
    }
    const { data, error } = await this.client.auth.admin.updateUserById(
      authUserId,
      {
        email_confirm: true,
        user_metadata: { full_name: fullName },
        app_metadata: {
          ...current.user.app_metadata,
          registration_pending: false,
        },
      },
    );
    if (error) throw error;

    return data.user;
  }

  async generatePasswordResetLink(
    email: string,
    redirectTo: string,
    authUserId: string,
  ) {
    const { data: linkData, error: linkError } =
      await this.client.auth.admin.generateLink({
        type: 'recovery',
        email,
      });
    if (linkError) throw linkError;

    if (
      linkData.user.id !== authUserId ||
      !linkData.properties.hashed_token
    ) {
      throw new Error('Recovery link identity does not match application user');
    }

    const recoveryUrl = new URL(redirectTo);
    recoveryUrl.hash = new URLSearchParams({
      token_hash: linkData.properties.hashed_token,
      type: 'recovery',
      user_id: authUserId,
    }).toString();

    return recoveryUrl.toString();
  }
}
