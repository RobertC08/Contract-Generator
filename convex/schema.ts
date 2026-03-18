import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v, Infer } from "convex/values";

export const CURRENCIES = { USD: "usd", EUR: "eur" } as const;
export const currencyValidator = v.union(
  v.literal(CURRENCIES.USD),
  v.literal(CURRENCIES.EUR),
);
export type Currency = Infer<typeof currencyValidator>;

export const INTERVALS = { MONTH: "month", YEAR: "year" } as const;
export const intervalValidator = v.union(
  v.literal(INTERVALS.MONTH),
  v.literal(INTERVALS.YEAR),
);
export type Interval = Infer<typeof intervalValidator>;

export const PLANS = { FREE: "free", PRO: "pro" } as const;
export const planKeyValidator = v.union(
  v.literal(PLANS.FREE),
  v.literal(PLANS.PRO),
);
export type PlanKey = Infer<typeof planKeyValidator>;

const priceValidator = v.object({
  stripeId: v.string(),
  amount: v.number(),
});
const pricesValidator = v.object({
  [CURRENCIES.USD]: priceValidator,
  [CURRENCIES.EUR]: priceValidator,
});

const contractStatus = v.union(
  v.literal("DRAFT"),
  v.literal("SENT"),
  v.literal("SIGNED")
);

const signerRole = v.union(
  v.literal("teacher"),
  v.literal("student"),
  v.literal("guardian"),
  v.literal("school_music")
);

const authMethod = v.union(v.literal("otp"), v.literal("magic_link"));

const orgMemberRole = v.union(
  v.literal("owner"),
  v.literal("admin"),
  v.literal("member")
);

const inviteRole = v.union(v.literal("admin"), v.literal("member"));

export default defineSchema({
  ...authTables,
  users: defineTable({
    name: v.optional(v.string()),
    username: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    customerId: v.optional(v.string()),
  })
    .index("email", ["email"])
    .index("customerId", ["customerId"]),
  organizations: defineTable({
    name: v.string(),
    slug: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
  })
    .index("by_slug", ["slug"])
    .index("by_ownerId", ["ownerId"]),
  members: defineTable({
    orgId: v.id("organizations"),
    userId: v.id("users"),
    role: orgMemberRole,
    joinedAt: v.number(),
  })
    .index("by_orgId", ["orgId"])
    .index("by_userId", ["userId"])
    .index("by_orgId_userId", ["orgId", "userId"]),
  invitations: defineTable({
    orgId: v.id("organizations"),
    email: v.string(),
    role: inviteRole,
    invitedBy: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
    acceptedAt: v.optional(v.number()),
  })
    .index("by_orgId", ["orgId"])
    .index("by_token", ["token"])
    .index("by_email", ["email"]),
  plans: defineTable({
    key: planKeyValidator,
    stripeId: v.string(),
    name: v.string(),
    description: v.string(),
    prices: v.object({
      [INTERVALS.MONTH]: pricesValidator,
      [INTERVALS.YEAR]: pricesValidator,
    }),
  })
    .index("key", ["key"])
    .index("stripeId", ["stripeId"]),
  subscriptions: defineTable({
    userId: v.id("users"),
    planId: v.id("plans"),
    priceStripeId: v.string(),
    stripeId: v.string(),
    currency: currencyValidator,
    interval: intervalValidator,
    status: v.string(),
    currentPeriodStart: v.number(),
    currentPeriodEnd: v.number(),
    cancelAtPeriodEnd: v.boolean(),
  })
    .index("userId", ["userId"])
    .index("stripeId", ["stripeId"]),
  contractTemplates: defineTable({
    orgId: v.optional(v.id("organizations")),
    name: v.string(),
    fileStorageId: v.id("_storage"),
    previewPdfStorageId: v.optional(v.id("_storage")),
    version: v.number(),
    variableDefinitions: v.optional(v.any()),
    addendumForContractId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_addendumForContractId", ["addendumForContractId"])
    .index("by_createdAt", ["createdAt"])
    .index("by_orgId", ["orgId"]),

  contractNumberSequences: defineTable({
    templateId: v.id("contractTemplates"),
    lastNumber: v.number(),
  }).index("by_templateId", ["templateId"]),

  contracts: defineTable({
    orgId: v.optional(v.id("organizations")),
    templateId: v.id("contractTemplates"),
    parentContractId: v.optional(v.id("contracts")),
    variables: v.optional(v.any()),
    variablesList: v.optional(v.array(v.object({ key: v.string(), value: v.string() }))),
    documentStorageId: v.optional(v.id("_storage")),
    status: contractStatus,
    documentHash: v.optional(v.string()),
    templateVersion: v.optional(v.number()),
    draftEditToken: v.optional(v.string()),
    /** Flat key-value for external systems (e.g. ToneTrack student/school ids). */
    integrationMetadata: v.optional(v.record(v.string(), v.string())),
    /** HTTPS URL to POST contract.signed when signing completes. */
    integrationWebhookUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_templateId", ["templateId"])
    .index("by_parentContractId", ["parentContractId"])
    .index("by_draftEditToken", ["draftEditToken"])
    .index("by_createdAt", ["createdAt"])
    .index("by_orgId", ["orgId"]),

  signers: defineTable({
    contractId: v.id("contracts"),
    fullName: v.string(),
    email: v.string(),
    phone: v.optional(v.string()),
    role: signerRole,
    signingOrder: v.number(),
    signedAt: v.optional(v.number()),
    token: v.string(),
    tokenExpiresAt: v.number(),
  })
    .index("by_contractId", ["contractId"])
    .index("by_token", ["token"]),

  signingOtps: defineTable({
    signerId: v.id("signers"),
    hashedCode: v.string(),
    expiresAt: v.number(),
    usedAt: v.optional(v.number()),
  }).index("by_signerId", ["signerId"]),

  integrationApiKeys: defineTable({
    orgId: v.id("organizations"),
    keyHash: v.string(),
    keyPrefix: v.string(),
    name: v.string(),
    createdAt: v.number(),
    revokedAt: v.optional(v.number()),
    lastUsedAt: v.optional(v.number()),
  })
    .index("by_keyHash", ["keyHash"])
    .index("by_orgId", ["orgId"]),

  signatureAuditLogs: defineTable({
    contractId: v.id("contracts"),
    signerId: v.id("signers"),
    ip: v.optional(v.string()),
    userAgent: v.optional(v.string()),
    device: v.optional(v.string()),
    deviceSignature: v.optional(v.string()),
    authMethod,
    documentHash: v.optional(v.string()),
    contractVersion: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_contractId", ["contractId"])
    .index("by_createdAt", ["createdAt"]),
});
