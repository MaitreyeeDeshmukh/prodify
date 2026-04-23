import { NextRequest, NextResponse } from "next/server";
import { insforge } from "@/lib/insforge";
import { resetPasswordSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { token, password } = result.data;

    const { data, error } = await insforge.auth.resetPassword({
      otp: token,
      newPassword: password,
    });

    if (error) {
      return NextResponse.json(
        {
          error: {
            token: [
              "This reset code is invalid or has expired. Please request a new one.",
            ],
          },
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { message: data?.message ?? "Password reset successfully. You can now sign in." },
      { status: 200 }
    );
  } catch (err) {
    console.error("[reset-password] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
