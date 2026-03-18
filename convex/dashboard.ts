import { query } from "./_generated/server";
import { getActiveOrgId } from "./organizations";

export const get = query({
  args: {},
  handler: async (ctx) => {
    const orgId = await getActiveOrgId(ctx);
    const allTemplates = await ctx.db.query("contractTemplates").collect();
    const templates = allTemplates
      .filter((t) => t.addendumForContractId === undefined && (orgId ? (t.orgId === orgId || !t.orgId) : !t.orgId))
      .sort((a, b) => b.createdAt - a.createdAt);

    const allContracts = await ctx.db.query("contracts").collect();
    const orgContracts = orgId ? allContracts.filter((c) => c.orgId === orgId || !c.orgId) : allContracts.filter((c) => !c.orgId);
    const statusCounts = { DRAFT: 0, SENT: 0, SIGNED: 0 };
    for (const c of orgContracts) {
      statusCounts[c.status]++;
    }

    const recentContracts = orgContracts
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 15);

    const contractIds = new Set(orgContracts.map((c) => c._id));
    const recentAudits = (await ctx.db
      .query("signatureAuditLogs")
      .withIndex("by_createdAt")
      .order("desc")
      .take(50))
      .filter((a) => contractIds.has(a.contractId))
      .slice(0, 10);

    const templateIds = new Set(templates.map((t) => t._id));
    const contractCountByTemplate = new Map<string, number>();
    for (const c of orgContracts) {
      const key = c.templateId;
      contractCountByTemplate.set(key, (contractCountByTemplate.get(key) ?? 0) + 1);
    }

    const signerCountByContract = new Map<string, number>();
    const signers = await ctx.db.query("signers").collect();
    for (const s of signers) {
      if (!contractIds.has(s.contractId)) continue;
      const key = s.contractId;
      signerCountByContract.set(key, (signerCountByContract.get(key) ?? 0) + 1);
    }

    const templatesWithCount = templates.map((t) => ({
      id: t._id,
      name: t.name,
      version: t.version,
      createdAt: t.createdAt,
      contractsCount: contractCountByTemplate.get(t._id) ?? 0,
    }));

    const recentContractsWithDetails = await Promise.all(
      recentContracts.map(async (c) => {
        const template = await ctx.db.get(c.templateId);
        return {
          id: c._id,
          status: c.status,
          createdAt: c.createdAt,
          templateId: c.templateId,
          templateName: template?.name ?? "—",
          signersCount: signerCountByContract.get(c._id) ?? 0,
        };
      })
    );

    const recentAuditsWithDetails = await Promise.all(
      recentAudits.map(async (a) => {
        const signer = await ctx.db.get(a.signerId);
        return {
          id: a._id,
          createdAt: a.createdAt,
          signerName: signer?.fullName ?? "—",
          signerEmail: signer?.email ?? "—",
          device: a.device,
          deviceSignature: a.deviceSignature,
          authMethod: a.authMethod,
          contractId: a.contractId,
        };
      })
    );

    return {
      templates: templatesWithCount,
      contractCounts: {
        draft: statusCounts.DRAFT,
        sent: statusCounts.SENT,
        signed: statusCounts.SIGNED,
        total: statusCounts.DRAFT + statusCounts.SENT + statusCounts.SIGNED,
      },
      recentContracts: recentContractsWithDetails,
      recentAudits: recentAuditsWithDetails,
    };
  },
});
