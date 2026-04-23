import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { forgotPasswordSchema } from "@/lib/validations";
import { createPasswordResetToken } from "@/lib/tokens";
import { sendPasswordResetEmail } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { email } = result.data;

    // Always return success to prevent email enumeration
    const user = await prisma.user.findUnique({ where: { email } });

    if (user) {
      const token = await createPasswordResetToken(user.id);
      await sendPasswordResetEmail(email, token);
    }

    return NextResponse.json(
      {
        message:
          "If an account with that email exists, we sent a reset link.",
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("[forgot-password] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
