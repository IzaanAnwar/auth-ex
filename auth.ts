import { DrizzleAdapter } from "@auth/drizzle-adapter";
import NextAuth, { NextAuthConfig } from "next-auth";
import { env } from "@/lib/env/server";
import Google from "next-auth/providers/google";
import { db } from "@/drizzle/index";
import { eq } from "drizzle-orm";
import { accounts, users } from "@/drizzle/schema";
const authConfig = {
  // @ts-ignore
  adapter: DrizzleAdapter(db),
  session: {
    strategy: "jwt",
  },
  trustHost: true,
  providers: [
    Google({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          scope:
            "openid https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/youtube.upload",
        },
      },
    }),
  ],

  pages: {
    signIn: "/signin",
  },

  callbacks: {
    async jwt({ user, token }) {
      if (user) {
        return {
          ...token,
          id: user.id,
        };
      }
      return token;
    },
    async session({ token, session }) {
      if (!session.user.id) {
        const user = await db.query.users.findFirst({
          where: eq(users.email, session.user.email as string),
        });
        if (!session.user.refreshToken) {
          const account = await db.query.accounts.findFirst({
            where: eq(accounts.userId, user?.id!),
          });
          session.user.refreshToken = account?.refresh_token!;
        }
        if (user) {
          session.user.id = user.id;
          session.user.isSubActive = user.isSubActive;
          session.user.role = user.role;
        }
      }
      if (!session.user.channelId) {
        const userData = await db.query.users.findFirst({
          where: eq(users.email, session.user.email as string),
        });
        if (userData) {
          session.user.channelId = userData.channelId;
        }
      }

      return session;
    },
  },
} satisfies NextAuthConfig;

// @ts-ignore
export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
