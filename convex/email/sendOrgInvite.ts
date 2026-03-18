"use node";

import { internalAction } from "../_generated/server";
import { v } from "convex/values";
import { sendOrgInviteEmail } from "./templates/orgInviteEmail";

export const sendOrgInvite = internalAction({
  args: {
    email: v.string(),
    orgName: v.string(),
    token: v.string(),
  },
  handler: async (_ctx, args) => {
    await sendOrgInviteEmail({
      email: args.email,
      orgName: args.orgName,
      token: args.token,
    });
  },
});
