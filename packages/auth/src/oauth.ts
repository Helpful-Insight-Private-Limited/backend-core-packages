export interface OAuthProfile {
  provider: 'google' | 'github';
  providerId: string;
  email: string;
  name?: string;
  avatarUrl?: string;
}

export class GoogleOAuthHelper {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {}

  getAuthorizationUrl(state?: string, scopes: string[] = ['email', 'profile']): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      response_type: 'code',
      scope: scopes.join(' '),
      access_type: 'offline',
      prompt: 'consent'
    });
    if (state) params.append('state', state);
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthProfile> {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: this.clientId,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code'
      }).toString()
    });

    if (!tokenRes.ok) {
      throw new Error(`Google token exchange failed: ${await tokenRes.text()}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` }
    });

    if (!userRes.ok) {
      throw new Error(`Google user profile fetch failed: ${await userRes.text()}`);
    }

    const userData = (await userRes.json()) as any;
    return {
      provider: 'google',
      providerId: userData.sub,
      email: userData.email,
      name: userData.name,
      avatarUrl: userData.picture
    };
  }
}

export class GithubOAuthHelper {
  constructor(
    private clientId: string,
    private clientSecret: string,
    private redirectUri: string
  ) {}

  getAuthorizationUrl(state?: string, scopes: string[] = ['read:user', 'user:email']): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: scopes.join(' ')
    });
    if (state) params.append('state', state);
    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  async exchangeCode(code: string): Promise<OAuthProfile> {
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        redirect_uri: this.redirectUri
      })
    });

    if (!tokenRes.ok) {
      throw new Error(`GitHub token exchange failed: ${await tokenRes.text()}`);
    }

    const tokenData = (await tokenRes.json()) as { access_token: string; error?: string };
    if (tokenData.error) {
      throw new Error(`GitHub OAuth error: ${tokenData.error}`);
    }

    const userRes = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'User-Agent': 'node-express-auth'
      }
    });
    const userData = (await userRes.json()) as any;

    let email = userData.email;
    if (!email) {
      // Fetch primary verified email
      const emailsRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'node-express-auth'
        }
      });
      const emails = (await emailsRes.json()) as any[];
      const primary = emails.find((e) => e.primary && e.verified);
      email = primary ? primary.email : emails[0]?.email;
    }

    return {
      provider: 'github',
      providerId: String(userData.id),
      email: email || '',
      name: userData.name || userData.login,
      avatarUrl: userData.avatar_url
    };
  }
}
