import { NextRequest, NextResponse } from "next/server";
import { insforge } from "@/lib/insforge";
import { forgotPasswordSchema } from "@/lib/validations";

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

    // InsForge prevents email enumeration internally — always returns success
    await insforge.auth.sendResetPasswordEmail({
      email,
      redirectTo: `${process.env.NEXTAUTH_URL}/reset-password`,
    });

    return NextResponse.json(
      {
        message:
          "If an account with that email exists, we sent a password reset link. Click the link in the email to set a new password.",
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
