import { NextRequest, NextResponse } from "next/server";
import { insforge } from "@/lib/insforge";
import { signupSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = signupSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, email, password } = result.data;

    const { data, error } = await insforge.auth.signUp({
      email,
      password,
      name,
      redirectTo: `${process.env.NEXTAUTH_URL}/login`,
    });

    if (error) {
      // Map InsForge error codes to user-friendly messages
      const msg = error.message ?? "Something went wrong";
      const rawStatus = (error as { statusCode?: number }).statusCode;
      const status =
        typeof rawStatus === "number" && rawStatus >= 200 && rawStatus <= 599
          ? rawStatus
          : 400;
      return NextResponse.json({ error: msg }, { status });
    }

    if (data?.requireEmailVerification) {
      return NextResponse.json(
        {
          requireEmailVerification: true,
          message:
            "Account created! Check your email for a verification code.",
        },
        { status: 201 }
      );
    }

    return NextResponse.json(
      { user: { id: data?.user?.id, email: data?.user?.email } },
      { status: 201 }
    );
  } catch (err) {
    console.error("[signup] unexpected error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
