import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope:
            "openid email profile https://www.googleapis.com/auth/calendar.readonly",
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  session: { strategy: "jwt" },
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        // First sign-in: find or create user in DB
        let user = await prisma.user.findUnique({
          where: { email: profile.email! },
        });
        if (!user) {
          user = await prisma.user.create({
            data: {
              email: profile.email!,
              name: profile.name ?? null,
              image: (profile as Record<string, unknown>).picture as string ?? null,
            },
          });
        }
        token.sub = user.id;
        token.name = user.name;
        token.email = user.email;
        token.picture = user.image;

        // Store Google tokens for Calendar API
        await prisma.user.update({
          where: { id: user.id },
          data: {
            name: profile.name ?? user.name,
            image: (profile as Record<string, unknown>).picture as string ?? user.image,
            googleAccessToken: account.access_token,
            googleRefreshToken: account.refresh_token,
            googleTokenExpiry: account.expires_at
              ? new Date(account.expires_at * 1000)
              : null,
          },
        });
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub!;
      session.user.name = token.name;
      session.user.email = token.email!;
      session.user.image = token.picture as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
});
