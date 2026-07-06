import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendApplicationNotification } from "@/lib/email";

const schema = z.object({
  firstName:      z.string().min(1, "First name required"),
  lastName:       z.string().min(1, "Last name required"),
  email:          z.string().email("Valid email required"),
  phone:          z.string().min(1, "Phone required"),
  address:        z.string().min(1, "Address required"),
  city:           z.string().min(1, "City required"),
  state:          z.string().min(1, "State required"),
  zip:            z.string().min(1, "ZIP required"),
  dateOfBirth:    z.string().min(1, "Date of birth required"),
  licenseNumber:  z.string().regex(/^\d{8}$/, "CA DRE license must be exactly 8 digits"),
  licenseType:    z.enum(["SALESPERSON", "BROKER_ASSOCIATE"]),
  licenseExpDate: z.string().min(1, "License expiration date required"),
  yearsLicensed:  z.number().int().min(0),
  formerBrokerage:z.string().optional().default(""),
  boardOfRealtors:z.string().optional().default(""),
  desiredMembershipAssociation: z.string().optional().default(""),
  mlsId:          z.string().optional().default(""),
  hasActiveListings:       z.boolean(),
  hasActiveSales:          z.boolean(),
  commissionEntity:        z.enum(["PERSONAL", "LLC", "S_CORP", "C_CORP"]),
  hasDisciplinaryHistory:  z.boolean(),
  disciplinaryExplain:     z.string().optional().default(""),
  hasInvestigationHistory: z.boolean(),
  investigationExplain:    z.string().optional().default(""),
  drePerJuryCert:          z.boolean().refine((v) => v === true, { message: "DRE certification required" }),
  specialties:    z.array(z.string()).default([]),
  bio:            z.string().optional().default(""),
  instagramUrl:   z.string().optional().default(""),
  facebookUrl:    z.string().optional().default(""),
  icaOpenedAt:    z.string().datetime(),
  icaAgreedAt:    z.string().datetime(),
  recaptchaToken: z.string().min(1, "reCAPTCHA token required"),
});

async function verifyRecaptcha(token: string): Promise<boolean> {
  if (!process.env.RECAPTCHA_SECRET_KEY) return true; // skip in dev if not configured
  const res = await fetch(
    `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${token}`,
    { method: "POST" }
  );
  const data = await res.json();
  return data.success === true && (data.score ?? 1) >= 0.5;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const data = schema.parse(body);

    const recaptchaOk = await verifyRecaptcha(data.recaptchaToken);
    if (!recaptchaOk) {
      return NextResponse.json({ error: "reCAPTCHA verification failed. Please try again." }, { status: 400 });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";

    const app = await prisma.agentApplication.create({
      data: {
        firstName:       data.firstName,
        lastName:        data.lastName,
        email:           data.email,
        phone:           data.phone,
        address:         data.address,
        city:            data.city,
        state:           data.state,
        zip:             data.zip,
        dateOfBirth:     data.dateOfBirth,
        licenseNumber:   data.licenseNumber,
        licenseType:     data.licenseType,
        licenseExpDate:  data.licenseExpDate,
        yearsLicensed:   data.yearsLicensed,
        formerBrokerage: data.formerBrokerage,
        boardOfRealtors: data.boardOfRealtors || null,
        desiredMembershipAssociation: data.desiredMembershipAssociation || null,
        mlsId:           data.mlsId || null,
        hasActiveListings:       data.hasActiveListings,
        hasActiveSales:          data.hasActiveSales,
        commissionEntity:        data.commissionEntity,
        hasDisciplinaryHistory:  data.hasDisciplinaryHistory,
        disciplinaryExplain:     data.disciplinaryExplain || null,
        hasInvestigationHistory: data.hasInvestigationHistory,
        investigationExplain:    data.investigationExplain || null,
        drePerJuryCert:          data.drePerJuryCert,
        specialties:    data.specialties,
        bio:            data.bio || null,
        instagramUrl:   data.instagramUrl || null,
        facebookUrl:    data.facebookUrl || null,
        icaOpenedAt:    new Date(data.icaOpenedAt),
        icaAgreedAt:    new Date(data.icaAgreedAt),
        submissionIp:   ip,
      },
    });

    Promise.resolve(sendApplicationNotification(app)).catch(console.error);

    return NextResponse.json({ id: app.id }, { status: 201 });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 });
    }
    console.error("[POST /api/agent-applications]", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
